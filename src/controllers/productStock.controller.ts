import { createCrudController } from "./crud.controller";
import { productStockService } from "../services/productStock.service";

export const productStockController = createCrudController(productStockService);
