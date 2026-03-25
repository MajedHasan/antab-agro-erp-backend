import { createCrudService } from "./crud.service";
import { PackagingStock } from "../models/packagingItems.model";

const base = createCrudService(PackagingStock, {
  allowedFilterFields: ["packagingItemId", "factoryId"],
  defaultPopulate: ["packagingItemId", "factoryId"],
});

export const packagingStockService = {
  ...base,
};
