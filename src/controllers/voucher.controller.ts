// src/controllers/voucher.controller.ts

import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import { voucherService } from "../services/voucher.service";

/* =========================================================
   Voucher Controller
========================================================= */

export const voucherController = {
  ...createCrudController(voucherService, { defaultPopulate: [] }),

  /* =======================================================
     LIST
  ======================================================= */
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 15,
        type,
        status,
        fromDate,
        toDate,
        q,
      } = req.query;

      const filter: any = {};

      if (type) filter.type = type;
      if (status) filter.status = status;

      if (fromDate || toDate) {
        filter.date = {};
        if (fromDate) filter.date.$gte = new Date(String(fromDate));

        if (toDate) {
          const dt = new Date(String(toDate));
          dt.setHours(23, 59, 59, 999);
          filter.date.$lte = dt;
        }
      }

      const result = await voucherService.list({
        filter,
        page: Number(page),
        limit: Number(limit),
        sort: "-date",
        q: q ? String(q) : undefined,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  /* =======================================================
     GET (with lines)
  ======================================================= */
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await voucherService.getById(req.params.id);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  },

  /* =======================================================
     CREATE (Always Pending)
  ======================================================= */
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = {
        ...req.body,
        createdBy: (req as any).user?.userId,
      };

      const created = await voucherService.create(payload);

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  },

  /* =======================================================
     UPDATE (Blocked If Approved)
  ======================================================= */
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await voucherService.update(req.params.id, {
        ...req.body,
        updatedBy: (req as any).user?.userId,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  /* =======================================================
     DELETE (Blocked If Approved)
  ======================================================= */
  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await voucherService.remove(req.params.id);
      res.json({ success: true, data: deleted });
    } catch (err) {
      next(err);
    }
  },

  /* =======================================================
     WORKFLOW
  ======================================================= */

  // Pending → Approved
  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await voucherService.approve(
        req.params.id,
        (req as any).user?.userId,
      );

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  // Pending → Rejected
  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;

      const updated = await voucherService.reject(
        req.params.id,
        (req as any).user?.userId,
        reason,
      );

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  /* =======================================================
     HELPER ROUTES
  ======================================================= */

  journal: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const voucher = await voucherService.create({
        ...req.body,
        type: "Journal",
        createdBy: (req as any).user?.userId,
      });

      res.json({ success: true, data: voucher });
    } catch (e) {
      next(e);
    }
  },

  contra: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entries = req.body.entries || [];
      const lines: any[] = [];

      for (const e of entries) {
        lines.push(
          {
            accountId: e.toLedgerId,
            debit: e.amount,
            credit: 0,
            narration: e.narration,
          },
          {
            accountId: e.fromLedgerId,
            debit: 0,
            credit: e.amount,
            narration: e.narration,
          },
        );
      }

      const voucher = await voucherService.create({
        ...req.body,
        type: "Contra",
        lines,
        createdBy: (req as any).user?.userId,
      });

      res.json({ success: true, data: voucher });
    } catch (e) {
      next(e);
    }
  },

  simplePaymentOrReceive:
    (type: string) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const voucher = await voucherService.create({
          ...req.body,
          type,
          createdBy: (req as any).user?.userId,
        });

        res.json({ success: true, data: voucher });
      } catch (e) {
        next(e);
      }
    },
};
