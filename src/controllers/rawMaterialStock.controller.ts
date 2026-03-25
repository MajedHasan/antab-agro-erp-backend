import { createCrudController } from "./crud.controller";
import { rawMaterialStockService } from "../services/rawMaterialStock.service";

export const rawMaterialStockController = createCrudController(
  rawMaterialStockService
);
