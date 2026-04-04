// src/models/otherProducts.model.ts
import mongoose from "mongoose";

const OtherProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  unit: { type: String, enum: ["pcs"], default: "pcs" },
  purchasePrice: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 0 },
  isReusable: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const OtherProducts = mongoose.model("OtherProducts", OtherProductSchema);
export default OtherProducts;

const OtherProductStockSchema = new mongoose.Schema({
  otherProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OtherProducts",
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

OtherProductStockSchema.index(
  { otherProductId: 1, factoryId: 1 },
  { unique: true },
);

export const OtherProductStock = mongoose.model(
  "OtherProductStock",
  OtherProductStockSchema,
);
