// src/controllers/statement-of-changes-in-equity.controller.ts
import { Request, Response, NextFunction } from "express";
import { statementOfChangesInEquityService } from "../services/statement-of-changes-in-equity.service";

export const statementOfChangesInEquityController = {
  async view(req: Request, res: Response, next: NextFunction) {
    try {
      const { year } = req.query;
      if (!year)
        return res
          .status(400)
          .json({ success: false, message: "Year is required" });

      const data = await statementOfChangesInEquityService.generate(
        String(year),
      );

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
