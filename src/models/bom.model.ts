// src/models/bom.model.ts
import mongoose from "mongoose";

const BOMSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },

  components: [
    {
      itemType: {
        type: String,
        enum: ["RawMaterial", "PackagingItem"],
        required: true,
      },

      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "components.itemType",
      },

      quantity: { type: Number, required: true }, // base quantity
      unit: { type: String },

      rule: {
        type: {
          type: String,
          enum: ["PER_UNIT", "PER_N_UNITS"],
          required: true,
        },
        n: { type: Number }, // e.g. 100 packs
      },

      roundingMethod: {
        type: String,
        enum: ["NONE", "CEIL", "FLOOR", "ROUND"],
        default: "NONE",
      },

      wastagePercent: { type: Number, default: 0 },
    },
  ],

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.BOM || mongoose.model("BOM", BOMSchema);
