// src/controllers/financial-note.controller.ts
import { Request, Response, NextFunction } from "express";
import { financialNoteService } from "../services/financial-note.service";
import { createCrudController } from "./crud.controller";
import { Account } from "../models/account.model";

const base = createCrudController(financialNoteService);

export const financialNoteController = {
  ...base,

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, statement, year, noteType, status, q, sort, select, populate } = req.query as any;
      const result = await financialNoteService.list({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 15,
        statement: statement || undefined,
        year: year ? Number(year) : undefined,
        noteType: noteType || undefined,
        status: status || undefined,
        q: q || undefined,
        sort: sort || "year:desc,statement:asc,displayOrder:asc",
        select,
        populate,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await financialNoteService.getNoteWithCurrentBalances(req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  getNextNumber: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { year, statement } = req.query as any;
      if (!year || !statement) {
        return res.status(400).json({ success: false, message: "year and statement are required" });
      }
      const data = await financialNoteService.getNextNoteNumber(Number(year), statement);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  finalise: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await financialNoteService.finalise(req.params.id, user?.name || user?.email || "System");
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  reopen: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await financialNoteService.reopen(req.params.id, user?.name || user?.email || "System");
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  move: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const direction = req.body?.direction;
      if (direction !== "up" && direction !== "down") {
        return res.status(400).json({ success: false, message: "direction must be 'up' or 'down'" });
      }
      const data = await financialNoteService.move(req.params.id, direction);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // 🆕 New — used by the account picker to build hierarchy client-side
  getAccountTree: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const accounts = await Account.find({ deletedAt: { $exists: false } })
        .select("_id code name type parent balance openingBalance closingBalance")
        .lean();
      res.json({ success: true, data: accounts });
    } catch (err) { next(err); }
  },

  // 🆕 New — lets the user see rollup totals BEFORE saving
  previewRollup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ids: string[] = Array.isArray(req.body?.accountIds) ? req.body.accountIds : [];
      // the service already has this logic; expose a light version
      const svc: any = financialNoteService as any;
      // we're reusing resolveAccountsWithRollup indirectly by creating a throwaway preview
      // simplest: call create-like resolution via a new helper
      // (implemented in service — see resolveAccountsWithRollup export below)
      const data = await (financialNoteService as any).previewRollup?.(ids);
      if (!data) {
        return res.status(400).json({ success: false, message: "Preview not available" });
      }
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};