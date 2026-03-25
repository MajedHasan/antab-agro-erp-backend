import { Request, Response, NextFunction } from "express";
import { statementOfProfitLossService } from "../services/statement-of-profit-loss.service";

export const statementOfProfitLossController = {
  async view(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodType, period, comparePeriod } = req.query;

      const data = await statementOfProfitLossService.generate({
        periodType: periodType as "monthly" | "yearly",
        period: String(period),
        comparePeriod: comparePeriod ? String(comparePeriod) : undefined,
      });

      res.json(data);
    } catch (err) {
      next(err);
    }
  },
};
