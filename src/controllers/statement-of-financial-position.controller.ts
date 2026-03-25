import { Request, Response, NextFunction } from "express";
import { statementOfFinancialPositionService } from "../services/statement-of-financial-position.service";

export const statementOfFinancialPositionController = {
  async view(req: Request, res: Response, next: NextFunction) {
    try {
      const { asOfDate, year, comparative } = req.query;

      const data = await statementOfFinancialPositionService.generate({
        asOfDate: String(asOfDate),
        year: Number(year),
        comparative: comparative === "true",
      });

      res.json(data);
    } catch (err) {
      next(err);
    }
  },
};
