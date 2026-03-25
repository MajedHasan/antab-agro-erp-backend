// src/models/product.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import slugify from "slugify";

export interface IProduct extends Document {
  name: string;
  sku: string;
  code?: string;
  category?: string;
  tags?: string[];
  unit: string;
  costPrice?: number;
  salePrice?: number;
  taxRate?: number;
  barcode?: string;
  stock?: number; // optional summary
  reorderLevel?: number;
  description?: string;
  images?: { url: string; alt?: string }[];
  status?: string;
  createdBy?: Types.ObjectId;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  attributes?: any;

  accountId?: Types.ObjectId;

  hasPromotion?: boolean;
  defaultBonusRule?: {
    buyQty?: number;
    getQty?: number;
  };
}

const productImageSchema = new Schema(
  { url: { type: String, required: true }, alt: { type: String } },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, index: true },
    sku: { type: String, required: true, unique: true, index: true },
    code: { type: String, index: true },
    category: { type: String },
    tags: [{ type: String }],
    unit: { type: String, default: "pcs" },
    costPrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    barcode: { type: String, index: true },
    stock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    description: { type: String },
    images: { type: [productImageSchema], default: [] },
    status: { type: String, default: "Active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    weight: { type: Number },
    dimensions: { length: Number, width: Number, height: Number },
    attributes: { type: Schema.Types.Mixed },

    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      index: true,
    },

    // ADD THIS inside productSchema (do not remove anything else)

    hasPromotion: { type: Boolean, default: false },

    defaultBonusRule: {
      buyQty: { type: Number, min: 1 },
      getQty: { type: Number, min: 1 },
    },
  },
  { timestamps: true },
);

productSchema.pre("save", function (next) {
  if (this.sku) this.sku = this.sku.trim().toUpperCase();
  if (!this.code && this.name)
    this.code = slugify(this.name, { lower: true, strict: true }).slice(0, 50);
  next();
});

productSchema.pre("validate", function (next) {
  if (this.defaultBonusRule) {
    const { buyQty, getQty } = this.defaultBonusRule;
    if ((buyQty && !getQty) || (!buyQty && getQty)) {
      return next(
        new Error("Both buyQty and getQty are required in defaultBonusRule"),
      );
    }
  }
  next();
});

productSchema.index({ name: "text", sku: "text", barcode: "text" });
productSchema.index({ hasPromotion: 1 });

export default mongoose.models.Product ||
  mongoose.model("Product", productSchema);
