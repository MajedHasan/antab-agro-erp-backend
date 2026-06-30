// src/models/materialWip.model.ts
import mongoose, { Schema } from "mongoose";

/**
 * =========================================================
 * Subdocuments
 * =========================================================
 */

// Each finished product produced in this WIP session
const ConversionProductSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantityProduced: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    // BOM-based expectation for this product batch
    expectedRawUsed: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    actualRawUsed: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    // Cost allocation for this product batch
    rawMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    packagingMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    otherMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    totalCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    unitCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },
  },
  { _id: false },
);

// Any material consumed in conversion besides the main raw material
const OtherMaterialSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: ["RawMaterial", "PackagingItem"],
      required: true,
    },

    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    unit: {
      type: String,
      required: true,
    },

    unitCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    totalCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },
  },
  { _id: false },
);

// One conversion record, either pending or approved
const ConversionSchema = new Schema(
  {
    products: {
      type: [ConversionProductSchema],
      default: [],
    },

    // BOM expectations
    expectedRawUsed: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    allowedWastageRawUsed: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    // Actual production result
    actualRawUsed: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    remainingRawQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    // Derived manufacturing analysis
    gainQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    normalWastageQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    productionLossQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    // Cost summaries
    rawMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    packagingMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    otherMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    totalInputCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    totalFinishedGoodsCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    otherMaterialsUsed: {
      type: [OtherMaterialSchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

/**
 * =========================================================
 * Main WIP Schema
 * =========================================================
 */

const MaterialWIPSchema = new Schema(
  {
    factoryId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
      index: true,
    },

    rawMaterialId: {
      type: Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true,
      index: true,
    },

    // One WIP record per day per raw material per factory
    date: {
      type: Date,
      required: true,
      default: () => new Date(new Date().toDateString()),
      index: true,
    },

    /**
     * =====================================================
     * Stock issue summary
     * =====================================================
     */
    initialQuantity: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    remainingQuantity: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    // Same unit as the main raw material
    unit: {
      type: String,
      required: true,
    },

    unitCost: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    startCost: {
      type: Number,
      required: true,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    /**
     * =====================================================
     * Easy reporting fields
     * =====================================================
     */
    issuedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    consumedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    expectedRawUsed: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    allowedWastageRawUsed: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    actualRawUsed: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    gainQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    normalWastageQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    productionLossQuantity: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    rawMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    packagingMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    otherMaterialCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    totalInputCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    totalFinishedGoodsCost: {
      type: Number,
      default: 0,
      min: 0,
      set: (v: any) => parseFloat(v)
    },

    status: {
      type: String,
      enum: ["ACTIVE", "PENDING_APPROVAL", "APPROVED", "REJECTED"],
      default: "ACTIVE",
      index: true,
    },

    /**
     * =====================================================
     * Conversion history
     * =====================================================
     */
    conversions: {
      type: [ConversionSchema],
      default: [],
    },

    /**
     * =====================================================
     * Pending conversion before approval
     * =====================================================
     */
    pendingConversion: {
      type: ConversionSchema,
      default: undefined,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    startVoucherIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Voucher",
      },
    ],

    returnVoucherId: {
      type: Schema.Types.ObjectId,
      ref: "Voucher",
    },

    conversionVoucherId: {
      type: Schema.Types.ObjectId,
      ref: "Voucher",
    },
  },
  { timestamps: true },
);

/**
 * =========================================================
 * Indexes
 * =========================================================
 */

// One ACTIVE or PENDING_APPROVAL WIP per raw material per day per factory
MaterialWIPSchema.index(
  { factoryId: 1, rawMaterialId: 1, date: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["ACTIVE", "PENDING_APPROVAL"] },
    },
  },
);

export default mongoose.models.MaterialWIP ||
  mongoose.model("MaterialWIP", MaterialWIPSchema);