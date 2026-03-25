import { Request, Response, NextFunction } from "express";
import { trialBalanceService } from "../services/trial-balance.service";

export const trialBalanceController = {
  async view(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodType, period } = req.query;
      if (!periodType || !period)
        return res
          .status(400)
          .json({ error: "periodType and period required" });

      const data = await trialBalanceService.generate({
        periodType: periodType as "monthly" | "yearly",
        period: String(period),
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
