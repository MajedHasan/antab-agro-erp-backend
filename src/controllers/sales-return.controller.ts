// src/controllers/sales-return.controller.ts

import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import { salesReturnService } from "../services/sales-return.service";

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.userId ? String(user.userId) : null;
}

export const salesReturnController = {
  ...createCrudController(salesReturnService),

  /* ================================
     CREATE
  ================================= */
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const payload = {
        ...req.body,
        createdBy: userId,
        updatedBy: userId,
      };

      const data = await salesReturnService.create(payload);

      res.status(201).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     UPDATE
  ================================= */
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await salesReturnService.update(req.params.id, {
        ...req.body,
        updatedBy: userId,
      });

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     APPROVE
     POST /sales-returns/:id/approve
     body: { role, remarks?, invoiceReturns? }
  ================================= */
  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { role, remarks, invoiceReturns } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "role is required",
        });
      }

      const data = await salesReturnService.approve(
        req.params.id,
        role,
        userId,
        {
          remarks,
          invoiceReturns,
        },
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     REJECT
     POST /sales-returns/:id/reject
     body: { role, remarks? }
  ================================= */
  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { role, remarks } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "role is required",
        });
      }

      const data = await salesReturnService.reject(
        req.params.id,
        role,
        userId,
        remarks,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     HOLD
     POST /sales-returns/:id/hold
     body: { remarks?, holdReason? }
  ================================= */
  hold: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { remarks, holdReason } = req.body;

      const data = await salesReturnService.hold(
        req.params.id,
        userId,
        remarks,
        holdReason,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     RESOLVE HOLD
     POST /sales-returns/:id/resolve-hold
     body: { remarks?, invoiceReturns? }
  ================================= */
  resolveHold: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await salesReturnService.resolveHold(
        req.params.id,
        userId,
        req.body,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     MARK PRINTED
     POST /sales-returns/:id/printed
  ================================= */
  markPrinted: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await salesReturnService.markPrinted(req.params.id, userId);

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     SEND TO WAREHOUSE
     POST /sales-returns/:id/send-to-warehouse
     body: { remarks? }
  ================================= */
  sendToWarehouse: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { remarks } = req.body;

      const data = await salesReturnService.sendToWarehouse(
        req.params.id,
        userId,
        remarks,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     WAREHOUSE RECEIVE
     POST /sales-returns/:id/warehouse-receive
     body: { invoiceReturns?, remarks?, holdReason? }
  ================================= */
  warehouseReceive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await salesReturnService.warehouseReceive(
        req.params.id,
        userId,
        req.body,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     COMPLETE
     POST /sales-returns/:id/complete
     body: { remarks? }
  ================================= */
  complete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { remarks } = req.body;

      const data = await salesReturnService.complete(
        req.params.id,
        userId,
        remarks,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     CANCEL
     POST /sales-returns/:id/cancel
     body: { remarks? }
  ================================= */
  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const { remarks } = req.body;

      const data = await salesReturnService.cancel(
        req.params.id,
        userId || undefined,
        remarks,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     PRINT DATA
     GET /sales-returns/:id/print
  ================================= */
  getPrintableReturnData: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await salesReturnService.getPrintableReturnData(
        req.params.id,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     RETURN QUANTITIES
     GET /sales-returns/returnable-quantities?invoiceId=...
  ================================= */
  getReturnableQuantities: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { invoiceId } = req.query;

      if (!invoiceId || typeof invoiceId !== "string") {
        return res.status(400).json({
          success: false,
          message: "invoiceId query parameter is required",
        });
      }

      const data = await salesReturnService.getReturnableQuantities(invoiceId as string);

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};