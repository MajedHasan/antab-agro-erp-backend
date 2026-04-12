import { Request, Response, NextFunction } from "express";
import { materialWipService } from "../services/materialWip.service";

export const materialWipController = {
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.startWip({
        ...req.body,
        userId: (req as any).user?.userId,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.getPossibleProducts(
        req.params.rawMaterialId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async convert(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.convertToProduct(req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.completeWip(req.body.wipId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipService.listWip(req.query);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
