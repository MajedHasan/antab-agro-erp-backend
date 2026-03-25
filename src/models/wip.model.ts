import mongoose, { Schema } from "mongoose";

/**
 * Production Work In Progress
 *
 * Raw/Packaging deducted immediately.
 * Finished produced gradually.
 * Remaining material in WIP calculated dynamically.
 */

const ProductionWIPSchema = new Schema(
  {
    factoryId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // 🔹 Production Plan
    plannedQuantity: {
      type: Number,
      required: true,
    },

    // 🔹 Production Status
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED"],
      default: "IN_PROGRESS",
    },

    // 🔹 Audit Fields
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    startedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    completedAt: Date,
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // 🔥 BOM Snapshot (VERY IMPORTANT)
    components: [
      {
        itemType: {
          type: String,
          enum: ["RawMaterial", "PackagingItem"],
          required: true,
        },

        itemId: {
          type: Schema.Types.ObjectId,
          required: true,
        },

        // 🔥 Quantity required per 1 finished unit
        quantityPerUnit: {
          type: Number,
          required: true,
        },

        // 🔥 Total deducted when production started
        totalConsumedQuantity: {
          type: Number,
          required: true,
        },

        unit: {
          type: String,
        },
      },
    ],

    // 🔥 Finished Tracking
    finishedProduced: {
      type: Number,
      default: 0,
    },

    transferredToWarehouse: {
      type: Number,
      default: 0,
    },

    notes: String,
  },
  {
    timestamps: true,
  },
);

/**
 * Useful Indexes
 */
ProductionWIPSchema.index({ factoryId: 1 });
ProductionWIPSchema.index({ productId: 1 });
ProductionWIPSchema.index({ status: 1 });

export default mongoose.model("ProductionWIP", ProductionWIPSchema);
