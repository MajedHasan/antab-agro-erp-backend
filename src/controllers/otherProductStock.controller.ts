import { createCrudController } from "./crud.controller";
import { otherProductStockService } from "../services/otherProductStock.service";

export const otherProductStockController = createCrudController(
  otherProductStockService,
);
