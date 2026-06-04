import { createCrudController } from "./crud.controller";
import { warehouseOrFactoryService } from "../services/warehouseOrFactory.service";
import { Request, Response, NextFunction } from "express";

const base = createCrudController(warehouseOrFactoryService, {
  defaultPopulate: [
    "assignedUsers",
    { path: "address.zone", model: "Zone" },
    { path: "address.region", model: "Region" },
    { path: "address.areas", model: "Area" },
    { path: "address.territories", model: "Territory" },
  ],
});

export const warehouseOrFactoryController = {
  ...base,

  async assignUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];

      const result = await warehouseOrFactoryService.assignUsers(
        req.params.id,
        userIds,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async removeUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await warehouseOrFactoryService.removeUser(
        req.params.id,
        req.params.userId,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await warehouseOrFactoryService.listUsers(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async getWithAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await warehouseOrFactoryService.getWithAddress(
        req.params.id,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
};

export type WarehouseOrFactoryController = typeof warehouseOrFactoryController;
