// src/models/warehouse-transfer.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type TransferType = "WAREHOUSE_TO_WAREHOUSE" | "FACTORY_TO_WAREHOUSE";
export type TransferMode = "REQUEST" | "DIRECT";

export type TransferStatus =
  | "REQUESTED"
  | "RECEIVER_NSM_APPROVED"
  | "SENDER_REVIEWED"
  | "SENDER_NSM_APPROVED"
  | "SENT"
  | "HOLD"
  | "AWAITING_REMAINING"
  | "COMPLETED";

export type QtyHistoryStage =
  | "CREATED"
  | "DRAFT_UPDATED"
  | "RECEIVER_NSM_APPROVED"
  | "SENDER_REVIEWED"
  | "SENDER_NSM_APPROVED"
  | "SENT"
  | "HOLD"
  | "AWAITING_REMAINING"
  | "COMPLETED";

export interface ITransferQtyHistory {
  stage: QtyHistoryStage;
  qty: number;
  changedBy: Types.ObjectId;
  changedAt: Date;
  note?: string;
}

export interface ITransferItem {
  productId: Types.ObjectId;
  requestedQty: number;
  finalQty: number;
  receivedQty?: number;         // <-- NEW
  unit?: string;
  costPrice?: number;
  qtyHistory: ITransferQtyHistory[];
}

export interface ITransferApprovalLog {
  actionBy: Types.ObjectId;
  role: string;
  status: TransferStatus | "CREATED" | "UPDATED";
  remarks?: string;
  actionAt: Date;
}

export interface IPrintSnapshot {
  transferNo: string;
  sender: {
    id: Types.ObjectId;
    name?: string;
  };
  receiver: {
    id: Types.ObjectId;
    name?: string;
  };
  items: Array<{
    productId: Types.ObjectId;
    name?: string;
    sku?: string;
    qty: number;
    unit?: string;
  }>;
  printedBy: Types.ObjectId;
  printedByName?: string;
  printedAt: Date;
}

export interface ITransferDocuments {
  signed?: {
    mediaId: Types.ObjectId;
    uploadedBy: Types.ObjectId;
    uploadedByName?: string;
    uploadedAt: Date;
  };
  damage?: {                  // <-- NEW
    mediaId: Types.ObjectId;
    uploadedBy: Types.ObjectId;
    uploadedByName?: string;
    uploadedAt: Date;
    reason?: string;
  };
}

export interface IWarehouseTransfer extends Document {
  transferNo: string;

  transferType: TransferType;
  transferMode: TransferMode;

  sender: Types.ObjectId;
  receiver: Types.ObjectId;

  items: ITransferItem[];

  status: TransferStatus;
  locked: boolean;

  createdBy: Types.ObjectId;

  receiverNsmApprovedBy?: Types.ObjectId;
  receiverNsmApprovedAt?: Date;

  senderReviewedBy?: Types.ObjectId;
  senderReviewedAt?: Date;

  senderNsmApprovedBy?: Types.ObjectId;
  senderNsmApprovedAt?: Date;

  dispatchedBy?: Types.ObjectId;
  dispatchedAt?: Date;

  receivedBy?: Types.ObjectId;
  receivedAt?: Date;

  // cancelledBy, cancelReason, rejectedBy, rejectReason removed

  printSnapshot?: IPrintSnapshot;
  documents?: ITransferDocuments;

  approvalLogs: ITransferApprovalLog[];

  voucherId: Types.ObjectId;

  // 🆕 Batch reservation tracking
  reservationIds: Types.ObjectId[];
}

// ---- sub-schemas ----
const QtyHistorySchema = new Schema<ITransferQtyHistory>(
  {
    stage: {
      type: String,
      enum: [
        "CREATED",
        "DRAFT_UPDATED",
        "RECEIVER_NSM_APPROVED",
        "SENDER_REVIEWED",
        "SENDER_NSM_APPROVED",
        "SENT",
        "HOLD",
        "AWAITING_REMAINING",
        "COMPLETED",
      ],
      required: true,
    },
    qty: { type: Number, required: true, min: 1 },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    note: String,
  },
  { _id: false },
);

const TransferItemSchema = new Schema<ITransferItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    requestedQty: {
      type: Number,
      required: true,
      min: 1,
    },
    finalQty: {
      type: Number,
      required: true,
      min: 1,
    },
    receivedQty: { type: Number, default: 0, min: 0 },  // <-- NEW
    unit: String,
    costPrice: Number,
    qtyHistory: {
      type: [QtyHistorySchema],
      default: [],
    },
  },
  { _id: false },
);

const ApprovalLogSchema = new Schema<ITransferApprovalLog>(
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
      enum: [
        "CREATED",
        "UPDATED",
        "REQUESTED",
        "RECEIVER_NSM_APPROVED",
        "SENDER_REVIEWED",
        "SENDER_NSM_APPROVED",
        "SENT",
        "HOLD",
        "AWAITING_REMAINING",
        "COMPLETED",
      ],
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

const SnapshotLocationSchema = new Schema(
  {
    id: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },
    name: String,
  },
  { _id: false },
);

const SnapshotItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: String,
    sku: String,
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: String,
  },
  { _id: false },
);

const PrintSnapshotSchema = new Schema<IPrintSnapshot>(
  {
    transferNo: { type: String, required: true },
    sender: { type: SnapshotLocationSchema, required: true },
    receiver: { type: SnapshotLocationSchema, required: true },
    items: { type: [SnapshotItemSchema], default: [] },
    printedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    printedByName: String,
    printedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const DocumentsSchema = new Schema<ITransferDocuments>(
  {
    signed: {
      mediaId: {
        type: Schema.Types.ObjectId,
        ref: "Media",
      },
      uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      uploadedByName: String,
      uploadedAt: Date,
    },
    damage: {                              // <-- NEW
      mediaId: {
        type: Schema.Types.ObjectId,
        ref: "Media",
      },
      uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      uploadedByName: String,
      uploadedAt: Date,
      reason: String,
    },
  },
  { _id: false },
);

// ---- main schema ----
const WarehouseTransferSchema = new Schema<IWarehouseTransfer>(
  {
    transferNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    transferType: {
      type: String,
      enum: ["WAREHOUSE_TO_WAREHOUSE", "FACTORY_TO_WAREHOUSE"],
      required: true,
    },

    transferMode: {
      type: String,
      enum: ["REQUEST", "DIRECT"],
      required: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
      index: true,
    },

    receiver: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
      index: true,
    },

    items: {
      type: [TransferItemSchema],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "REQUESTED",
        "RECEIVER_NSM_APPROVED",
        "SENDER_REVIEWED",
        "SENDER_NSM_APPROVED",
        "SENT",
        "HOLD",
        "AWAITING_REMAINING",
        "COMPLETED",
      ],
      default: "REQUESTED",
      index: true,
    },

    locked: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiverNsmApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    receiverNsmApprovedAt: Date,

    senderReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    senderReviewedAt: Date,

    senderNsmApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    senderNsmApprovedAt: Date,

    dispatchedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    dispatchedAt: Date,

    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    receivedAt: Date,

    // cancelledBy, cancelReason, rejectedBy, rejectReason removed

    printSnapshot: PrintSnapshotSchema,
    documents: DocumentsSchema,

    approvalLogs: {
      type: [ApprovalLogSchema],
      default: [],
    },

    voucherId: {
      type: Schema.Types.ObjectId,
      ref: "Voucher",
    },

    reservationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "StockTransaction",
      },
    ],
  },
  { timestamps: true },
);

WarehouseTransferSchema.index({ sender: 1, receiver: 1, status: 1 });
WarehouseTransferSchema.index({ transferType: 1, transferMode: 1 });
WarehouseTransferSchema.index({ createdAt: -1 });

export default mongoose.models.WarehouseTransfer ||
  mongoose.model<IWarehouseTransfer>(
    "WarehouseTransfer",
    WarehouseTransferSchema,
  );