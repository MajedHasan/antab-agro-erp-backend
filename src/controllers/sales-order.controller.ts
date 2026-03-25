// src/controllers/sales-order.controller.ts

import { Request, Response, NextFunction } from "express";
import { salesOrderService } from "../services/sales-order.service";
import { createCrudController } from "./crud.controller";

export const salesOrderController = {
  ...createCrudController(salesOrderService),

  /* ================================
     CREATE (Audit Injected)
  ================================= */
  create: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const payload = {
        ...req.body,
        createdBy: user.userId,
        updatedBy: user.userId,
      };

      const created = await salesOrderService.create(payload);

      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     UPDATE (Audit Injected)
  ================================= */
  update: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const updated = await salesOrderService.update(req.params.id, {
        ...req.body,
        updatedBy: user.userId,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     APPROVE
  ================================= */
  approve: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { role } = req.body;
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!role) {
        res.status(400).json({
          success: false,
          message: "role is required",
        });
        return;
      }

      const order = await salesOrderService.approve(
        req.params.id,
        role,
        user.userId,
      );

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     SHIP
  ================================= */
  ship: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const order = await salesOrderService.ship(req.params.id, user.userId);

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  },

  /* ================================
     DELIVER
  ================================= */
  deliver: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const invoice = await salesOrderService.deliver(
        req.params.id,
        user.userId,
      );

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const result = await salesOrderService.cancel(req.params.id, user.userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
};
