// src/controllers/promotion.controller.ts
import { Request, Response, NextFunction } from "express";
import { promotionService } from "../services/product-promotion.service";
import { createCrudController } from "./crud.controller";
import mongoose from "mongoose";

export const promotionController = {
  ...createCrudController(promotionService),

  /**
   * GET /promotions/active?productId=&customerId=&warehouseId=
   */
  active: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, customerId, warehouseId } = req.query;

      if (!productId || typeof productId !== "string") {
        return res.status(400).json({
          success: false,
          message: "productId is required and must be a string",
        });
      }

      const productObjectId = new mongoose.Types.ObjectId(productId);
      const customerObjectId =
        customerId && typeof customerId === "string"
          ? new mongoose.Types.ObjectId(customerId)
          : undefined;
      const warehouseObjectId =
        warehouseId && typeof warehouseId === "string"
          ? new mongoose.Types.ObjectId(warehouseId)
          : undefined;

      const promotions = await promotionService.getActivePromotions(
        productObjectId,
        customerObjectId,
        warehouseObjectId,
      );

      res.json({ success: true, data: promotions });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /promotions/calculate-bonus?productId=&qty=&customerId=&warehouseId=
   */
  calculateBonus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, qty, customerId, warehouseId } = req.query;

      if (!productId || typeof productId !== "string") {
        return res.status(400).json({
          success: false,
          message: "productId is required and must be a string",
        });
      }

      if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) {
        return res.status(400).json({
          success: false,
          message: "qty is required and must be a positive number",
        });
      }

      const productObjectId = new mongoose.Types.ObjectId(productId);
      const customerObjectId =
        customerId && typeof customerId === "string"
          ? new mongoose.Types.ObjectId(customerId)
          : undefined;
      const warehouseObjectId =
        warehouseId && typeof warehouseId === "string"
          ? new mongoose.Types.ObjectId(warehouseId)
          : undefined;

      const result = await promotionService.calculateBonusQty(
        productObjectId,
        Number(qty),
        customerObjectId,
        warehouseObjectId,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
