import { Request, Response, NextFunction } from "express";
import { createCrudController } from "../../controllers/crud.controller";
import { tadaEntryService } from "./tadaEntry.service";
import { tadaMonthlySheetService } from "./tadaMonthlySheet.service";

const base = createCrudController(tadaEntryService, {
  defaultPopulate: [{ path: "employeeId", select: "name email designation" }],
});

function getUser(req: Request): any {
  return (req as any)?.user || null;
}

export const tadaEntryController = {
  ...base,

  async submitDailyEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const data = await tadaEntryService.submitDailyEntry(
        user.userId,
        req.body,
      );

      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async getMyEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const month = Number(req.query.month || new Date().getMonth() + 1);
      const year = Number(req.query.year || new Date().getFullYear());

      const data = await tadaEntryService.getEntriesByMonth(
        user.userId,
        month,
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

  async editEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);
      const data = await tadaMonthlySheetService.editEntry(
        req.params.id,
        req.body,
        user,
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },
};

export type TadaEntryController = typeof tadaEntryController;
