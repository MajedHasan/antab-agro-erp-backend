// src/models/packaging.model.ts
import mongoose from "mongoose";

const PackagingItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  unit: { type: String, enum: ["pcs"], default: "pcs" },
  purchasePrice: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 0 },
  isReusable: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const PackagingItem = mongoose.model("PackagingItem", PackagingItemSchema);
export default PackagingItem;

const PackagingStockSchema = new mongoose.Schema({
  packagingItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PackagingItem",
    required: true,
  },
  factoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WarehouseOrFactory",
    required: true,
  },
  quantity: { type: Number, default: 0 },
  unit: { type: String, enum: ["pcs"], default: "pcs" },
  batch: { type: String },
  expiryDate: { type: Date },
  lastUpdated: { type: Date, default: Date.now },
});

PackagingStockSchema.index(
  { packagingItemId: 1, factoryId: 1 },
  { unique: true }
);

export const PackagingStock = mongoose.model(
  "PackagingStock",
  PackagingStockSchema
);
