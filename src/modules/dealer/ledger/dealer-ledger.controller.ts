// src/controllers/dealer-ledger.controller.ts
import { Request, Response, NextFunction } from "express";
import { dealerLedgerService } from "./dealer-ledger.service";

export const dealerLedgerController = {
  async ledger(req: Request, res: Response, next: NextFunction) {
    try {
      const { dealerId } = req.params;
      const { startDate, endDate, type, page, limit } = req.query as any;

      const data = await dealerLedgerService.getLedger(dealerId, {
        startDate,
        endDate,
        type,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const { dealerId } = req.params;
      const data = await dealerLedgerService.getLedgerSummary(dealerId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};