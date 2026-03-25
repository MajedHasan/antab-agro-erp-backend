// src/controllers/warehouse-transfer.controller.ts

import { Request, Response, NextFunction } from "express";
import { warehouseTransferService } from "../services/warehouse-transfer.service";
import { createCrudController } from "./crud.controller";

/**
 * ==========================================================
 * Base CRUD Controller
 * - list
 * - get
 * - update
 * - delete
 * ==========================================================
 */
const baseController = createCrudController(warehouseTransferService);

export const warehouseTransferController = {
  ...baseController,

  /**
   * ==========================================================
   * CREATE (Override)
   * ==========================================================
   */
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const transfer = await warehouseTransferService.create({
        ...req.body,
        createdBy: user?.userId,
      });

      res.status(201).json({
        success: true,
        data: transfer,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * RECEIVE
   * ==========================================================
   */
  receive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const result = await warehouseTransferService.receive(
        req.params.id,
        user?.userId,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * FINAL APPROVE
   * ==========================================================
   */
  finalApprove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const result = await warehouseTransferService.finalApprove(
        req.params.id,
        user?.userId,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * CANCEL
   * ==========================================================
   */
  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const result = await warehouseTransferService.cancel(
        req.params.id,
        user?.userId,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
