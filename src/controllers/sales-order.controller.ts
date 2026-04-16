// src/controllers/sales-order.controller.ts

import { Request, Response, NextFunction } from "express";
import { salesOrderService } from "../services/sales-order.service";
import { createCrudController } from "./crud.controller";

export const salesOrderController = {
  ...createCrudController(salesOrderService),

  /* ================================
     CREATE
  ================================= */
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const payload = {
        ...req.body,
        createdBy: user.userId,
        updatedBy: user.userId,
      };

      const data = await salesOrderService.create(payload);

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
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await salesOrderService.update(req.params.id, {
        ...req.body,
        updatedBy: user.userId,
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
  ================================= */
  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, remarks } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "role is required",
        });
      }

      const data = await salesOrderService.approve(
        req.params.id,
        role,
        user.userId,
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
     REJECT
  ================================= */
  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, remarks } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "role is required",
        });
      }

      const data = await salesOrderService.reject(
        req.params.id,
        role,
        user.userId,
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
     SHIP (IMPORTANT)
     → returns printPayload with QR IMAGE
  ================================= */
  ship: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await salesOrderService.ship(req.params.id, user.userId);

      res.json({
        success: true,
        data: result, // includes printPayload (QR IMAGE ✅)
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     GET PRINTABLE INVOICE (FRONTEND PRINT BUTTON)
  ================================= */
  getPrintableInvoice: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await salesOrderService.getPrintableInvoiceData(
        req.params.id,
      );

      res.json({
        success: true,
        data, // includes qrCodeImage ✅
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     DELIVER (UPLOAD SIGNED INVOICE)
     → file already uploaded → send mediaId
  ================================= */
  deliver: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { uploadedDocumentFileId } = req.body;

      if (!uploadedDocumentFileId) {
        return res.status(400).json({
          success: false,
          message: "uploadedDocumentFileId is required",
        });
      }

      const data = await salesOrderService.deliver(
        req.params.id,
        user.userId,
        uploadedDocumentFileId,
      );

      res.json({
        success: true,
        data, // includes verification result ✅
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     CANCEL
  ================================= */
  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await salesOrderService.cancel(req.params.id);

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};
