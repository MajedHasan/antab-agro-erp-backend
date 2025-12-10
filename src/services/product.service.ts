// src/services/product.service.ts
import ProductModel from "../models/product.model";
import { createCrudService } from "./crud.service";

export const productService = createCrudService(ProductModel, {
  defaultPopulate: ["category", "warehouses.warehouse", "createdBy"],
  defaultSort: "-createdAt",
  defaultLimit: 25,
  searchFields: ["name", "sku", "code", "barcode", "tags"],
  allowedFilterFields: ["category", "status", "warehouse"],
  // Normalize SKU before create/update (ensures unique-casing)
  beforeCreate: async (payload: any) => {
    if (payload.sku && typeof payload.sku === "string")
      payload.sku = payload.sku.trim().toUpperCase();
    if (payload.name && !payload.code) {
      // simple fallback code generation (do not rely on uniqueness)
      payload.code = String(payload.name)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .slice(0, 50);
    }
    return payload;
  },
  beforeUpdate: async (id: string, payload: any) => {
    if (payload.sku && typeof payload.sku === "string")
      payload.sku = payload.sku.trim().toUpperCase();
    return payload;
  },
});
