import { createCrudController } from "./crud.controller";
import { warehouseService } from "../services/warehouse.service";
import { Request, Response, NextFunction } from "express";

const base = createCrudController(warehouseService, {
  defaultPopulate: "assignedUsers",
});

export const warehouseController = {
  ...base,

  async assignUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await warehouseService.assignUsers(
        req.params.id,
        req.body.userIds
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async removeUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await warehouseService.removeUser(
        req.params.id,
        req.params.userId
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await warehouseService.listUsers(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
