import { createCrudService } from "./crud.service";
import { RawMaterialStock } from "../models/rawMaterials.model";

const base = createCrudService(RawMaterialStock, {
  allowedFilterFields: ["rawMaterialId", "factoryId"],
  defaultPopulate: ["rawMaterialId", "factoryId"],
});

export const rawMaterialStockService = {
  ...base,
};
