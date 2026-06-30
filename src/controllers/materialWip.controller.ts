// src/controllers/materialWip.controller.ts
import { Request, Response, NextFunction } from "express";
import { materialWipService } from "../services/materialWip.service";

function getUserId(req: Request) {
  return (req as any).user?.userId;
}

export const materialWipController = {
  /**
   * Morning issue of raw material into WIP
   */
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.startWip({
        rawMaterialId: req.body.rawMaterialId,
        quantity: req.body.quantity,
        factoryId: req.body.factoryId,
        userId: getUserId(req),
      });

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get possible finished products from BOM for a selected raw material
   */
  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { rawMaterialId } = req.params;

      const data = await materialWipService.getPossibleProducts(rawMaterialId);

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Submit production result for review
   */
  async requestConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.requestConversion({
        wipId: req.body.wipId,
        factoryId: req.body.factoryId,
        products: req.body.products,
        remainingRawQuantity: req.body.remainingRawQuantity,
        bypassWastageCheck: req.body.bypassWastageCheck ?? false,
        userId: getUserId(req),
      });

      return res.json({
        success: true,
        warning: data.warning,
        data: data.wip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Approver edits the pending conversion before final approval
   */
  async updatePendingConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const data = await materialWipService.updatePendingConversion({
        wipId: id,
        factoryId: req.body.factoryId,
        products: req.body.products,
        remainingRawQuantity: req.body.remainingRawQuantity,
        notes: req.body.notes,
        userId: getUserId(req),
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Final approval and stock/voucher posting
   */
  async approveConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const data = await materialWipService.approveConversion({
        wipId: id,
        userId: getUserId(req),
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Reject the pending draft and send WIP back to ACTIVE
   */
  async rejectPendingConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const data = await materialWipService.rejectPendingConversion({
        wipId: id,
        factoryId: req.body.factoryId,
        reason: req.body.reason,
        userId: getUserId(req),
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * List WIP records with filtering
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await materialWipService.listWip({
        factoryId: req.query.factoryId,
        rawMaterialId: req.query.rawMaterialId,
        status: req.query.status,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        q: req.query.q,
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get one WIP by id
   */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.getWipById(req.params.id);

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "WIP not found",
        });
      }

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};