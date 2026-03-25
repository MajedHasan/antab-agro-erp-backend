import { createCrudController } from "./crud.controller";
import { packagingStockService } from "../services/packagingStock.service";

export const packagingStockController = createCrudController(
  packagingStockService
);
