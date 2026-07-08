import { createCrudController } from "../../controllers/crud.controller";
import { stockTransactionService } from "./stockTransaction.service";
import { Request, Response, NextFunction } from "express";

const base = createCrudController(stockTransactionService);

export const stockTransactionController = {
  ...base,

  /** Convenience endpoint – returns available purchase batches for manual selection */
  async getAvailableBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemType, itemId, locationId, sort } = req.query;
      const direction = sort === "FIFO" ? 1 : -1;
      const batches = await stockTransactionService.getAvailableBatches(
        itemType as string,
        itemId as string,
        locationId as string,
        direction,
      );
      res.json({ success: true, data: batches });
    } catch (err) {
      next(err);
    }
  },

  /** Batch history – trace the entire lifecycle of a purchase batch */
  async getBatchHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await stockTransactionService.getBatchHistory(
        req.params.batchId,
      );
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  },

  /** Get the latest unit cost for an item at a location */
  async getLatestUnitCost(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemType, itemId, locationId } = req.query;
      if (!itemType || !itemId || !locationId) {
        return res.status(400).json({
          success: false,
          message: "itemType, itemId, and locationId are required",
        });
      }
      const unitCost = await stockTransactionService.getLatestUnitCost(
        itemType as string,
        itemId as string,
        locationId as string,
      );
      return res.json({ success: true, unitCost });
    } catch (err) {
      next(err);
    }
  },

};
