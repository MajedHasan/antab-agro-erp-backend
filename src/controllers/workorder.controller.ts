// src/controllers/workorder.controller.ts

import { createCrudController } from "./crud.controller";
import { workOrderService } from "../services/workorder.service";
import { Request, Response, NextFunction } from "express";

const base = createCrudController(workOrderService);

export const workOrderController = {
  ...base,

  // async list(req: Request, res: Response, next: NextFunction) {
  //   const workOrders = await base.list(req.params);
  // },

  /* =====================================================
     APPROVE WORK ORDER
  ====================================================== */
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await workOrderService.approve(
        req.params.id,
        (req as any).user?.id,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     CANCEL WORK ORDER
  ====================================================== */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await workOrderService.cancel(
        req.params.id,
        (req as any).user?.id,
        req.body?.reason,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
