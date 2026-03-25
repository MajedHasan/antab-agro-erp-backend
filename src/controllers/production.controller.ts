import { Request, Response, NextFunction } from "express";
import { productionService } from "../services/production.service";

export const productionController = {
  /**
   * ==========================================================
   * 1️⃣ START PRODUCTION (Create New WIP)
   * ==========================================================
   */
  async startProduction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await productionService.startProduction({
        ...req.body,
        userId: (req as any).user?.userId, // if using auth middleware
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * 2️⃣ COMPLETE PRODUCTION (Partial)
   * ==========================================================
   */
  async completeProduction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await productionService.completeProduction({
        ...req.body,
        userId: (req as any).user?.userId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * 3️⃣ MANUAL CLOSE WIP
   * ==========================================================
   */
  async closeProduction(req: Request, res: Response, next: NextFunction) {
    try {
      const { wipId } = req.body;

      const result = await productionService.closeProduction(
        wipId,
        (req as any).user?.userId,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * 4️⃣ TRANSFER FACTORY → WAREHOUSE
   * ==========================================================
   */
  async transferToWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await productionService.transferToWarehouse({
        ...req.body,
        userId: (req as any).user?.userId,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * 5️⃣ VIEW MATERIALS IN WIP (Factory Summary)
   * ==========================================================
   */
  async getMaterialsInWip(req: Request, res: Response, next: NextFunction) {
    try {
      const { factoryId } = req.params;

      const result = await productionService.getMaterialsInWip(factoryId);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * 6️⃣ VIEW FINISHED GOODS IN FACTORY
   * ==========================================================
   */
  async getFinishedInFactory(req: Request, res: Response, next: NextFunction) {
    try {
      const { factoryId } = req.params;

      const result = await productionService.getFinishedInFactory(factoryId);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * ==========================================================
   * 7️⃣ LIST WIP
   * ==========================================================
   */
  async listWip(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await productionService.listWip({
        search: req.query.search as string,
        status: req.query.status as string,
        factoryId: req.query.factoryId as string,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
