// src/controllers/workorder.controller.ts

import { createCrudController } from "./crud.controller";
import { workOrderService } from "../services/workorder.service";
import { Request, Response, NextFunction } from "express";

const base = createCrudController(workOrderService);

/* =====================================================
   HELPER: GET USER ID SAFELY
===================================================== */
const getUserId = (req: Request) => {
  return (req as any)?.user?.userId || (req as any)?.user?.id || null;
};

export const workOrderController = {
  ...base,

  /* =====================================================
     CREATE
  ====================================================== */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);

      const payload = {
        ...req.body,
        createdBy: userId,
        updatedBy: userId,
      };

      const created = await workOrderService.create(payload);

      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (error) {
      next(error); // ✅ FIXED
    }
  },

  /* =====================================================
     UPDATE (attach updatedBy)
  ====================================================== */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);

      const payload = {
        ...req.body,
        updatedBy: userId,
      };

      const updated = await workOrderService.update(req.params.id, payload);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /* =====================================================
     STATUS: MOVE TO PROCESSING
  ====================================================== */
  async moveToProcessing(req: Request, res: Response, next: NextFunction) {
    try {
      console.log("workOrderService keys:", Object.keys(workOrderService));

      const result = await workOrderService.moveToProcessing(
        req.params.id,
        getUserId(req),
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* =====================================================
     STATUS: MOVE TO UNDER REVIEW
  ====================================================== */
  async moveToUnderReview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await workOrderService.moveToUnderReview(
        req.params.id,
        getUserId(req),
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* =====================================================
     APPROVE (CHAIRMAN)
  ====================================================== */
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);

      if (!userId) {
        throw new Error("Unauthorized: user not found");
      }

      const result = await workOrderService.approve(req.params.id, userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* =====================================================
     COMPLETE
  ====================================================== */
  async markCompleted(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await workOrderService.markCompleted(
        req.params.id,
        getUserId(req),
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* =====================================================
     CANCEL
  ====================================================== */
  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);

      const result = await workOrderService.cancel(
        req.params.id,
        userId,
        req.body?.reason,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  /* =====================================================
     FLEXIBLE STATUS (OPTIONAL)
  ====================================================== */
  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;

      const result = await workOrderService.setStatus(
        req.params.id,
        status,
        getUserId(req),
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
