// src/models/rawMaterial.model.ts
import mongoose from "mongoose";

const RawMaterialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, unique: true, required: true },
  category: { type: String }, // chemical, liquid, powder
  unit: { type: String, enum: ["kg", "g", "ltr", "ml"], required: true },
  purchasePrice: { type: Number, default: 0 },
  averagePrice: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

const RawMaterial = mongoose.model("RawMaterial", RawMaterialSchema);
export default RawMaterial;

const RawMaterialStockSchema = new mongoose.Schema({
  rawMaterialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RawMaterial",
    required: true,
  },
  factoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WarehouseOrFactory",
    required: true,
  },
  quantity: { type: Number, default: 0 },
  unit: { type: String, enum: ["kg", "g", "ltr", "ml"], required: true },
  batch: { type: String },
  expiryDate: { type: Date },
  lastUpdated: { type: Date, default: Date.now },
});

RawMaterialStockSchema.index(
  { rawMaterialId: 1, factoryId: 1 },
  { unique: true }
);

export const RawMaterialStock = mongoose.model(
  "RawMaterialStock",
  RawMaterialStockSchema
);
