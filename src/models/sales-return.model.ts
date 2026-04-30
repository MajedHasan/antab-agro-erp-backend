// src/models/sales-return.model.ts
import mongoose, { Schema, Document, Types, HydratedDocument } from "mongoose";

/* ===============================
   Item-level qty audit trail
================================ */

export type SalesReturnQtyStage = "M.O" | "A.M" | "R.M" | "N.S.M" | "WAREHOUSE";

export interface ISalesReturnQtyLog {
  stage: SalesReturnQtyStage;
  qty: number;
  remarks?: string;
  actionDate?: Date;
  userId?: Types.ObjectId;
}

/* ===============================
   Return item inside one invoice
================================ */

export interface ISalesReturnItem {
  productId: Types.ObjectId;

  // Snapshot from the original invoice line
  soldQty: number;
  soldBonusQty: number;
  soldUnitPrice: number;
  soldLineSubtotal: number;
  soldLineTotal: number;

  // What the sales man / M.O entered
  requestedQty: number;

  // Qty changes through approval flow
  amQty: number;
  rmQty: number;
  nsmQty: number;

  // Final approved qty before warehouse receiving
  finalApprovedQty: number;

  // What warehouse/depo actually received
  warehouseReceivedQty: number;

  // Return amount tracking
  returnAmountEstimate: number;
  finalReturnAmount: number;

  reason?: string;
  notes?: string;

  status:
    | "PENDING"
    | "APPROVED"
    | "HOLD"
    | "REJECTED"
    | "COMPLETED"
    | "CANCELLED";

  qtyAuditLogs: ISalesReturnQtyLog[];
}

/* ===============================
   Per-invoice return block
================================ */

export interface ISalesReturnInvoiceBlock {
  invoiceId: Types.ObjectId;
  orderId: Types.ObjectId;
  warehouseId: Types.ObjectId;

  invoiceNoSnapshot: string;

  paymentStatusSnapshot: "UNPAID" | "PARTIAL" | "PAID";
  paidAmountSnapshot: number;
  balanceAmountSnapshot: number;
  grandTotalSnapshot: number;

  items: ISalesReturnItem[];
}

/* ===============================
   Approval log
================================ */

export interface ISalesReturnApprovalLog {
  role: "M.O" | "A.M" | "R.M" | "N.S.M" | "WAREHOUSE";
  userId: Types.ObjectId;
  status: "APPROVED" | "REJECTED" | "PENDING";
  remarks?: string;
  actionDate?: Date;
}

/* ===============================
   Main Sales Return Interface
================================ */

export interface ISalesReturn extends Document {
  returnNo: string;

  customerId: Types.ObjectId;
  invoiceReturns: ISalesReturnInvoiceBlock[];

  status:
    | "PENDING_AM"
    | "PENDING_RM"
    | "PENDING_NSM"
    | "READY_FOR_PRINT"
    | "PRINTED"
    | "SENT_TO_WAREHOUSE"
    | "WAREHOUSE_RECEIVED"
    | "HOLD"
    | "RESOLVED"
    | "COMPLETED"
    | "REJECTED"
    | "CANCELLED";

  approvalLogs: ISalesReturnApprovalLog[];

  // Print / QR
  qrCode?: string;
  printCount: number;
  lastPrintedAt?: Date;
  signedReturnDocument?: Types.ObjectId;

  // Warehouse lifecycle
  submittedAt?: Date;
  warehouseReceivedAt?: Date;
  holdReason?: string;
  holdRemarks?: string;
  resolvedAt?: Date;
  completedAt?: Date;

  // Summary snapshots
  totalRequestedAmount: number;
  totalApprovedAmount: number;
  totalReceivedAmount: number;
  dealerDueReductionAmount: number;

  warehouseReceived: boolean;
  notes?: string;

  isActive: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

type SalesReturnDoc = HydratedDocument<ISalesReturn>;

/* ===============================
   Sub-schemas
================================ */

const ReturnQtyLogSchema = new Schema<ISalesReturnQtyLog>(
  {
    stage: {
      type: String,
      enum: ["M.O", "A.M", "R.M", "N.S.M", "WAREHOUSE"],
      required: true,
    },
    qty: { type: Number, required: true, min: 0 },
    remarks: { type: String },
    actionDate: { type: Date, default: Date.now },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: false },
);

const SalesReturnItemSchema = new Schema<ISalesReturnItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    soldQty: { type: Number, required: true, min: 0 },
    soldBonusQty: { type: Number, default: 0, min: 0 },
    soldUnitPrice: { type: Number, required: true, min: 0 },
    soldLineSubtotal: { type: Number, required: true, min: 0 },
    soldLineTotal: { type: Number, required: true, min: 0 },

    requestedQty: { type: Number, default: 0, min: 0 },

    amQty: { type: Number, default: 0, min: 0 },
    rmQty: { type: Number, default: 0, min: 0 },
    nsmQty: { type: Number, default: 0, min: 0 },

    finalApprovedQty: { type: Number, default: 0, min: 0 },
    warehouseReceivedQty: { type: Number, default: 0, min: 0 },

    returnAmountEstimate: { type: Number, default: 0, min: 0 },
    finalReturnAmount: { type: Number, default: 0, min: 0 },

    reason: { type: String },
    notes: { type: String },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "HOLD",
        "REJECTED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    qtyAuditLogs: {
      type: [ReturnQtyLogSchema],
      default: [],
    },
  },
  { _id: false },
);

const SalesReturnInvoiceBlockSchema = new Schema<ISalesReturnInvoiceBlock>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "SalesInvoice",
      required: true,
    },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },

    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    invoiceNoSnapshot: {
      type: String,
      required: true,
    },

    paymentStatusSnapshot: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      required: true,
    },

    paidAmountSnapshot: {
      type: Number,
      default: 0,
      min: 0,
    },

    balanceAmountSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },

    grandTotalSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },

    items: {
      type: [SalesReturnItemSchema],
      default: [],
    },
  },
  { _id: false },
);

const SalesReturnApprovalLogSchema = new Schema<ISalesReturnApprovalLog>(
  {
    role: {
      type: String,
      enum: ["M.O", "A.M", "R.M", "N.S.M", "WAREHOUSE"],
      required: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["APPROVED", "REJECTED", "PENDING"],
      default: "PENDING",
    },

    remarks: { type: String },
    actionDate: { type: Date, default: Date.now },
  },
  { _id: false },
);

/* ===============================
   Main Schema
================================ */

const SalesReturnSchema = new Schema<ISalesReturn>(
  {
    returnNo: {
      type: String,
      required: true,
      unique: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Dealer",
      required: true,
    },

    invoiceReturns: {
      type: [SalesReturnInvoiceBlockSchema],
      default: [],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING_AM",
        "PENDING_RM",
        "PENDING_NSM",
        "READY_FOR_PRINT",
        "PRINTED",
        "SENT_TO_WAREHOUSE",
        "WAREHOUSE_RECEIVED",
        "HOLD",
        "RESOLVED",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING_AM",
    },

    approvalLogs: {
      type: [SalesReturnApprovalLogSchema],
      default: [],
    },

    qrCode: {
      type: String,
      index: true,
    },

    printCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastPrintedAt: { type: Date },
    signedReturnDocument: {
      type: Schema.Types.ObjectId,
      ref: "Media",
    },

    submittedAt: { type: Date },
    warehouseReceivedAt: { type: Date },

    holdReason: { type: String },
    holdRemarks: { type: String },
    resolvedAt: { type: Date },
    completedAt: { type: Date },

    totalRequestedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalApprovedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalReceivedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dealerDueReductionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    warehouseReceived: {
      type: Boolean,
      default: false,
    },

    notes: { type: String },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

/* ===============================
   Indexes
================================ */

SalesReturnSchema.index({ returnNo: 1 });
SalesReturnSchema.index({ customerId: 1 });
SalesReturnSchema.index({ status: 1 });
SalesReturnSchema.index({ createdAt: -1 });
SalesReturnSchema.index({ "invoiceReturns.invoiceId": 1 });
SalesReturnSchema.index({ "invoiceReturns.orderId": 1 });

export default mongoose.models.SalesReturn ||
  mongoose.model<ISalesReturn>("SalesReturn", SalesReturnSchema);
