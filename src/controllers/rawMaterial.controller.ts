import { createCrudController } from "./crud.controller";
import { rawMaterialService } from "../services/rawMaterial.service";
import { Request, Response, NextFunction } from "express";

const base = createCrudController(rawMaterialService);

export const rawMaterialController = {
  ...base,

  // 🔧 example custom endpoint
  async updateAveragePrice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await rawMaterialService.adjustAveragePrice(
        req.params.id,
        req.body.price
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
