import { Request, Response, NextFunction } from "express";
import { moDashboardReportService } from "./moDashboardReport.service";

export const moDashboardReportController = {
  async getMoDashboardReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      const data = await moDashboardReportService.getMoDashboardReport(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error); // ✅ don’t swallow errors
    }
  },
};
