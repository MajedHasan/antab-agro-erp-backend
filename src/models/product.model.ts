// src/models/product.model.js
import mongoose from "mongoose";
import slugify from "slugify"; // optional helper - add to your deps (npm i slugify) or replace with simple logic

const Schema = mongoose.Schema;

const productImageSchema = new Schema({
  url: { type: String, required: true },
  alt: { type: String },
});

const productSchema = new Schema(
  {
    // basic identity
    name: { type: String, required: true, index: true },
    sku: { type: String, required: true, unique: true, index: true },
    code: { type: String, index: true }, // optional human-friendly code

    // classification
    // category: { type: Schema.Types.ObjectId, ref: "Category", required: false }, // optional ref
    category: { type: String, required: false }, // optional ref
    tags: [{ type: String }], // free-form tags

    // unit & measurement
    unit: { type: String, default: "pcs" },

    // pricing
    costPrice: { type: Number, default: 0 }, // how much it costs you
    salePrice: { type: Number, default: 0 }, // selling price
    taxRate: { type: Number, default: 0 }, // percent, e.g. 15

    // inventory
    barcode: { type: String, index: true },
    stock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 }, // when to re-order
    warehouses: [
      {
        // warehouse: { type: Schema.Types.ObjectId, ref: "Warehouse" },
        warehouse: { type: String, rquired: false },
        qty: { type: Number, default: 0 },
      },
    ],

    // media & description
    description: { type: String },
    images: { type: [productImageSchema], default: [] },

    // status & meta
    status: { type: String, default: "Active" }, // Active / Inactive / Discontinued
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    // computed helpers
    weight: { type: Number }, // optional
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    attributes: { type: Schema.Types.Mixed },

    // you can extend with vendor, manufacturer, etc.
  },
  { timestamps: true }
);

// pre-save helper: ensure SKU uppercase and code fallback
productSchema.pre("save", function (next) {
  if (this.sku && typeof this.sku === "string") {
    this.sku = this.sku.trim().toUpperCase();
  }
  if (!this.code && this.name) {
    // try to generate a short code from name if not provided
    try {
      // require slugify installed; otherwise simple fallback
      // npm i slugify
      this.code = slugify(this.name, { lower: true, strict: true }).slice(
        0,
        50
      );
    } catch (e) {
      this.code = this.name.toLowerCase().replace(/\s+/g, "-").slice(0, 50);
    }
  }
  next();
});

// compound index for faster lookups
productSchema.index({ name: "text", sku: "text", barcode: "text" });

export default mongoose.models.Product ||
  mongoose.model("Product", productSchema);
