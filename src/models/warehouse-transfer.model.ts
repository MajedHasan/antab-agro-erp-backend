// src/models/warehouse-transfer.model.ts

import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * ==========================================================
 * Transfer Item
 * One transfer can contain multiple products
 * ==========================================================
 */
export interface ITransferItem {
  productId: Types.ObjectId;
  quantity: number;

  // Snapshot at time of transfer
  unit?: string;
  costPrice?: number;
}

/**
 * ==========================================================
 * Transfer Approval Log
 * Keeps full audit history
 * ==========================================================
 */
export interface ITransferApprovalLog {
  actionBy: Types.ObjectId;
  role: string;

  status: "CREATED" | "RECEIVED_BY_WAREHOUSE" | "FINAL_APPROVED" | "REJECTED";

  remarks?: string;
  actionAt: Date;
}

/**
 * ==========================================================
 * Main Transfer Interface
 * ==========================================================
 */
export interface IWarehouseTransfer extends Document {
  transferNo: string;

  fromWarehouseId: Types.ObjectId;
  toWarehouseId: Types.ObjectId;

  items: ITransferItem[];

  /**
   * If true → stock can be used immediately
   * in destination warehouse
   */
  isVirtualTransfer: boolean;

  status:
    | "CREATED"
    | "RECEIVED_BY_WAREHOUSE"
    | "FINAL_APPROVED"
    | "REJECTED"
    | "CANCELLED";

  // Who created it
  createdBy: Types.ObjectId;

  // Who received
  receivedBy?: Types.ObjectId;
  receivedAt?: Date;

  // Who gave final approval
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  approvalLogs: ITransferApprovalLog[];
}

const TransferItemSchema = new Schema<ITransferItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unit: String,

    costPrice: Number,
  },
  { _id: false },
);

const TransferApprovalSchema = new Schema<ITransferApprovalLog>(
  {
    actionBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["CREATED", "RECEIVED_BY_WAREHOUSE", "FINAL_APPROVED", "REJECTED"],
      required: true,
    },

    remarks: String,

    actionAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const WarehouseTransferSchema = new Schema<IWarehouseTransfer>(
  {
    transferNo: {
      type: String,
      required: true,
      unique: true,
    },

    fromWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    toWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    items: {
      type: [TransferItemSchema],
      required: true,
    },

    isVirtualTransfer: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        "CREATED",
        "RECEIVED_BY_WAREHOUSE",
        "FINAL_APPROVED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "CREATED",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    receivedAt: Date,

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    approvalLogs: {
      type: [TransferApprovalSchema],
      default: [],
    },
  },
  { timestamps: true },
);

/**
 * ==========================================================
 * INDEXES
 * ==========================================================
 */

WarehouseTransferSchema.index({ transferNo: 1 });
WarehouseTransferSchema.index({ fromWarehouseId: 1 });
WarehouseTransferSchema.index({ toWarehouseId: 1 });
WarehouseTransferSchema.index({ status: 1 });

/**
 * ==========================================================
 * Export
 * ==========================================================
 */

export default mongoose.models.WarehouseTransfer ||
  mongoose.model<IWarehouseTransfer>(
    "WarehouseTransfer",
    WarehouseTransferSchema,
  );
