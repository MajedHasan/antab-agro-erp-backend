// src/controllers/account.controller.ts
import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import { accountService } from "../services/account.service";
import { getBalancesForPeriod } from "../services/ledger.service";
import { Account } from "../models/account.model";
import { parseISO } from "date-fns";

/**
 * ==========================================================
 * Tree Builder
 * ==========================================================
 */
function buildTreeWithBalances(accounts: any[], balancesMap: Map<string, any>) {
  const map: Record<string, any> = {};
  const roots: any[] = [];

  accounts.forEach((acc) => {
    const bal = balancesMap.get(String(acc._id)) || {
      opening: 0,
      periodDr: 0,
      periodCr: 0,
      closing: 0,
    };

    map[String(acc._id)] = {
      ...acc,
      openingBalance: bal.opening,
      periodDebit: bal.periodDr,
      periodCredit: bal.periodCr,
      closingBalance: bal.closing,
      children: [],
    };
  });

  accounts.forEach((acc) => {
    const parentId =
      acc.parent && typeof acc.parent === "object"
        ? String(acc.parent._id)
        : acc.parent
          ? String(acc.parent)
          : null;

    if (parentId && map[parentId]) {
      map[parentId].children.push(map[String(acc._id)]);
    } else {
      roots.push(map[String(acc._id)]);
    }
  });

  function aggregate(node: any) {
    if (!node.children || node.children.length === 0) {
      return {
        opening: node.openingBalance,
        periodDr: node.periodDebit,
        periodCr: node.periodCredit,
        closing: node.closingBalance,
      };
    }

    let opening = node.openingBalance || 0;
    let periodDr = node.periodDebit || 0;
    let periodCr = node.periodCredit || 0;
    let closing = node.closingBalance || 0;

    for (const c of node.children) {
      const childAgg = aggregate(c);
      opening += childAgg.opening;
      periodDr += childAgg.periodDr;
      periodCr += childAgg.periodCr;
      closing += childAgg.closing;
    }

    node.openingBalance = opening;
    node.periodDebit = periodDr;
    node.periodCredit = periodCr;
    node.closingBalance = closing;

    return { opening, periodDr, periodCr, closing };
  }

  for (const r of roots) aggregate(r);

  return roots;
}

function sumRootsByType(roots: any[], type: string) {
  return roots
    .filter((n) => n.type === type)
    .reduce((sum, n) => sum + (n.closingBalance || 0), 0);
}

/**
 * ==========================================================
 * Controller
 * ==========================================================
 */

export const accountController = {
  ...createCrudController(accountService),

  /**
   * ======================================================
   * CREATE ACCOUNT (kept EXACTLY same as before)
   * ======================================================
   */
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body || {};

      const openingBalance =
        payload.openingBalance !== undefined
          ? Number(payload.openingBalance || 0)
          : Number(payload.balance || 0);

      const voucherDate = payload.openingDate
        ? new Date(payload.openingDate)
        : new Date();

      const accountPayload: any = { ...payload };

      delete accountPayload.openingBalance;
      delete accountPayload.openingOffsetAccountId;
      delete accountPayload.openingDate;
      delete accountPayload.voucherNo;
      delete accountPayload.openingNarration;

      const created = await accountService.create(accountPayload);

      if (Math.abs(openingBalance) > 0.0001) {
        await (accountService as any).postOpening(
          String(created._id),
          Math.abs(openingBalance),
          {
            offsetAccountId: payload.openingOffsetAccountId,
            date: voucherDate,
            narration: payload.openingNarration,
          },
        );
      }

      const createdDoc = await accountService.getById(String(created._id));
      res.status(201).json({ success: true, data: createdDoc });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ======================================================
   * TREE
   * ======================================================
   */
  tree: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = req.query.from
        ? parseISO(String(req.query.from))
        : undefined;

      const to = req.query.to ? parseISO(String(req.query.to)) : undefined;

      const accountsRes = await accountService.list({
        filter: {},
        limit: 10000,
      });

      const accounts = accountsRes.data;
      const balancesMap = await getBalancesForPeriod(from, to);

      const tree = buildTreeWithBalances(accounts, balancesMap);

      res.json({ success: true, data: tree });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ======================================================
   * SUMMARY
   * ======================================================
   */
  summary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = req.query.from
        ? parseISO(String(req.query.from))
        : undefined;

      const to = req.query.to ? parseISO(String(req.query.to)) : undefined;

      const accountsRes = await accountService.list({
        filter: {},
        limit: 10000,
      });

      const accounts = accountsRes.data;
      const balancesMap = await getBalancesForPeriod(from, to);
      const tree = buildTreeWithBalances(accounts, balancesMap);

      const totals = {
        totalAssets: sumRootsByType(tree, "Asset"),
        totalLiabilities: sumRootsByType(tree, "Liability"),
        totalEquity: sumRootsByType(tree, "Equity"),
        totalRevenue: sumRootsByType(tree, "Revenue"),
        totalExpenses: sumRootsByType(tree, "Expense"),
      };

      res.json({ success: true, data: totals });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ======================================================
   * OPENING BALANCE SUMMARY
   * ======================================================
   */
  summaryOpeningBalance: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const accountsRes = await accountService.list({
        filter: {},
        limit: 10000,
      });

      const accounts = accountsRes.data;
      const balancesMap = await getBalancesForPeriod(undefined, undefined);

      const totals = {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        totalRevenue: 0,
        totalExpenses: 0,
      };

      accounts.forEach((acc) => {
        const bal = balancesMap.get(String(acc._id)) || { opening: 0 };

        switch (acc.type) {
          case "Asset":
            totals.totalAssets += bal.opening;
            break;
          case "Liability":
            totals.totalLiabilities += bal.opening;
            break;
          case "Equity":
            totals.totalEquity += bal.opening;
            break;
          case "Revenue":
            totals.totalRevenue += bal.opening;
            break;
          case "Expense":
            totals.totalExpenses += bal.opening;
            break;
        }
      });

      res.json({ success: true, data: totals });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ======================================================
   * NEW 🔥 OPTIONAL ADMIN ENDPOINTS
   *
   * These allow manual triggering of auto account system
   * from API if needed.
   * ======================================================
   */

  /**
   * POST /api/accounts/auto-entity
   * Body:
   * {
   *   entityType: "Dealer" | "Supplier" | "Product",
   *   entityId: string,
   *   name: string,
   *   productCategory?: "Raw" | "Packaging" | "Finished"
   * }
   */
  autoCreateEntityAccount: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const acc = await (accountService as any).createAutoAccountForEntity(
        req.body,
      );

      res.json({ success: true, data: acc });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/accounts/sync-entity-name
   * Body:
   * {
   *   entityType: "Dealer" | "Supplier" | "Product",
   *   entityId: string,
   *   newName: string
   * }
   */
  syncEntityName: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const acc = await (accountService as any).syncAccountNameForEntity(
        req.body,
      );

      res.json({ success: true, data: acc });
    } catch (err) {
      next(err);
    }
  },
};
