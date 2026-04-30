import { Request, Response, NextFunction } from "express";
import { createCrudController } from "../../controllers/crud.controller";
import { tadaMonthlySheetService } from "./tadaMonthlySheet.service";

const base = createCrudController(tadaMonthlySheetService, {
  defaultPopulate: [
    { path: "employeeId", select: "name designation mobileNo" },
  ],
});

function getUser(req: Request): any {
  return (req as any)?.user || null;
}

export const tadaMonthlySheetController = {
  ...base,

  async getMyMonthlyOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const year = req.query.year ? Number(req.query.year) : undefined;

      const data = await tadaMonthlySheetService.getMonthlyOverview(
        user.userId,
        year,
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async getSheetWithEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tadaMonthlySheetService.getSheetWithEntries(
        req.params.id,
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async submitSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const data = await tadaMonthlySheetService.submitMonthlySheet(
        req.params.id,
        user.userId,
        req.body,
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async checkSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const data = await tadaMonthlySheetService.checkMonthlySheet(
        req.params.id,
        user.userId,
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async approveSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const data = await tadaMonthlySheetService.approveMonthlySheet(
        req.params.id,
        user.userId,
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async rejectSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const reason = req.body?.reason;

      const data = await tadaMonthlySheetService.rejectMonthlySheet(
        req.params.id,
        user.userId,
        reason,
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async getTeamSheets(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        territory: req.query.territory as string | undefined,
        area: req.query.area as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const data = await tadaMonthlySheetService.getTeamSheets(filters);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },
};

export type TadaMonthlySheetController = typeof tadaMonthlySheetController;
