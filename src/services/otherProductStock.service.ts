import { createCrudService } from "./crud.service";
import { OtherProductStock } from "../models/otherProducts.model";

const base = createCrudService(OtherProductStock, {
  allowedFilterFields: ["otherProductId", "factoryId"],
  defaultPopulate: ["otherProductId", "factoryId"],
});

export const otherProductStockService = {
  ...base,
};
