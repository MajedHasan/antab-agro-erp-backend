import { Request, Response, NextFunction } from "express";
import { salesReturnService } from "../services/sales-return.service";
import { createCrudController } from "./crud.controller";

export const salesReturnController = {
  ...createCrudController(salesReturnService),

  /**
   * POST /sales-returns/:id/approve
   * body: { role }
   */
  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: "role is required",
        });
      }

      const userId = (req as any).user?.id;

      const returnDoc = await salesReturnService.approve(
        req.params.id,
        role,
        userId,
      );

      res.json({ success: true, data: returnDoc });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /sales-returns/:id/complete
   */
  complete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const returnDoc = await salesReturnService.complete(req.params.id);
      res.json({ success: true, data: returnDoc });
    } catch (err) {
      next(err);
    }
  },
};
