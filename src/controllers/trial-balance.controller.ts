import { Request, Response, NextFunction } from "express";
import { trialBalanceService } from "../services/trial-balance.service";
import { parseISO } from "date-fns";

export const trialBalanceController = {
  async view(req: Request, res: Response, next: NextFunction) {
    try {
      const from = req.query.from ? parseISO(String(req.query.from)) : undefined;
      const to = req.query.to ? parseISO(String(req.query.to)) : undefined;

      const data = await trialBalanceService.generate(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};