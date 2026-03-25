import { createCrudController } from "./crud.controller";
import { warehouseOrFactoryService } from "../services/warehouseOrFactory.service";
import { Request, Response, NextFunction } from "express";

const base = createCrudController(warehouseOrFactoryService, {
  defaultPopulate: "assignedUsers",
});

export const warehouseOrFactoryController = {
  ...base,

  async assignUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await warehouseOrFactoryService.assignUsers(
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
      const result = await warehouseOrFactoryService.removeUser(
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
      const result = await warehouseOrFactoryService.listUsers(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
