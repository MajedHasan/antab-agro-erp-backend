// src/controllers/gr.controller.ts

import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import { grService } from "../services/good-receipt.service";

/* =========================================================
   BASE CRUD
========================================================= */

const base = createCrudController(grService);

export const grController = {
  ...base,

  /* =====================================================
     APPROVE GR
  ====================================================== */
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const result = await grService.approve(req.params.id, userId);

      res.json({
        success: true,
        message: "GR approved successfully",
        data: result,
        transportVoucherId:
          result?.items?.find((i) => i.transportVoucherId)
            ?.transportVoucherId || null,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     REJECT GR
  ====================================================== */
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { reason } = req.body;

      const result = await grService.reject(req.params.id, userId, reason);

      res.json({
        success: true,
        message: "GR rejected successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     ADD PAYMENT TO GR
     (Supports multiple partial payments)
  ====================================================== */
  async addPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { amount, paymentDate } = req.body;

      const result = await grService.pay(
        req.params.id,
        Number(amount),
        userId,
        paymentDate,
      );

      res.json({
        success: true,
        message: "Payment added successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     ATTACH FILE TO GR
  ====================================================== */
  async attachFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.body;

      const result = await grService.attachFile(req.params.id, fileId);

      res.json({
        success: true,
        message: "File attached successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
};
