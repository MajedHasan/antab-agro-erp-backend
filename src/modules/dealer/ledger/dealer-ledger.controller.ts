// src/modules/dealer/ledger/dealer-ledger.controller.ts
import { Request, Response, NextFunction } from "express";
import { dealerLedgerService } from "./dealer-ledger.service";

const validTypes = ["SALE", "PAYMENT", "RETURN", "ALL"] as const;
type ValidType = (typeof validTypes)[number];

export const dealerLedgerController = {
  async ledger(req: Request, res: Response, next: NextFunction) {
    try {
      const { dealerId } = req.params;
      const { startDate, endDate, type, page, limit } = req.query as Record<
        string,
        string | undefined
      >;

      const safeType: ValidType =
        typeof type === "string" &&
        (validTypes as readonly string[]).includes(type)
          ? (type as ValidType)
          : "ALL";

      const data = await dealerLedgerService.getLedger(dealerId, {
        startDate,
        endDate,
        type: safeType,
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