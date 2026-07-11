// src/controllers/financial-note.controller.ts
import { Request, Response, NextFunction } from "express";
import { financialNoteService } from "../services/financial-note.service";
import { createCrudController } from "./crud.controller";

const base = createCrudController(financialNoteService);

export const financialNoteController = {
  ...base,

  // Override list to handle statement/year filters
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, statement, year, q, sort, select, populate } = req.query as any;
      const result = await financialNoteService.list({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 15,
        statement: statement || undefined,
        year: year ? Number(year) : undefined,
        q: q || undefined,
        sort: sort || "-createdAt",
        select,
        populate,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  // Get a single note with live balances
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await financialNoteService.getNoteWithCurrentBalances(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // Finalise (snapshot) a note
  finalise: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await financialNoteService.finalise(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};