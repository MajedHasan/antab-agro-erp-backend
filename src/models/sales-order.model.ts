import mongoose, { Schema, Document, Types } from "mongoose";

/* ===============================
   Order Item Interface
================================ */

export interface ISalesOrderItem {
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;

  qty: number;
  bonusQty: number;

  unitPrice: number;

  discountPercent?: number;
  discountAmount?: number;

  taxPercent?: number;
  taxAmount?: number;

  lineSubtotal: number;
  lineTotal: number;

  promotionId?: Types.ObjectId;
}

/* ===============================
   Approval History Interface
================================ */

export interface IApprovalLog {
  role: "M.O" | "A.M" | "R.M" | "N.S.M" | "A.C" | "WAREHOUSE" | "DELIVERY";

  userId: Types.ObjectId;

  status: "APPROVED" | "REJECTED" | "PENDING";

  remarks?: string;

  actionDate?: Date;
}

/* ===============================
   Main Sales Order Interface
================================ */

export interface ISalesOrder extends Document {
  orderNo: string;

  customerId: Types.ObjectId;
  warehouseId: Types.ObjectId;

  orderDate: Date;

  items: ISalesOrderItem[];

  subTotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;

  totalBonusQty: number;

  /* ======================
     Workflow Status
  ======================= */

  status:
    | "PENDING"
    | "A.M_CONFIRMED"
    | "R.M_CONFIRMED"
    | "N.S.M_CONFIRMED"
    | "A.C_CONFIRMED"
    | "IN_SHIPPING"
    | "DELIVERED"
    | "REJECTED"
    | "CANCELLED";

  approvalLogs: IApprovalLog[];

  /* ======================
     Delivery Info
  ======================= */

  deliveryManId?: Types.ObjectId;
  deliveryDate?: Date;

  /* ======================
     Invoice
  ======================= */

  invoiceId?: Types.ObjectId;
  isInvoiced: boolean;

  notes?: string;

  isActive: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/* ===============================
   Schemas
================================ */

const SalesOrderItemSchema = new Schema<ISalesOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    qty: { type: Number, required: true },
    bonusQty: { type: Number, default: 0 },

    unitPrice: { type: Number, required: true },

    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },

    lineSubtotal: { type: Number, required: true },
    lineTotal: { type: Number, required: true },

    promotionId: {
      type: Schema.Types.ObjectId,
      ref: "Promotion",
    },
  },
  { _id: false },
);

const ApprovalLogSchema = new Schema<IApprovalLog>(
  {
    role: {
      type: String,
      enum: ["M.O", "A.M", "R.M", "N.S.M", "A.C", "WAREHOUSE", "DELIVERY"],
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

    actionDate: { type: Date },
  },
  { _id: false },
);

const SalesOrderSchema = new Schema<ISalesOrder>(
  {
    orderNo: {
      type: String,
      required: true,
      unique: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Dealer",
      required: true,
    },

    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },

    items: {
      type: [SalesOrderItemSchema],
      required: true,
    },

    subTotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    totalBonusQty: { type: Number, default: 0 },

    status: {
      type: String,
      enum: [
        "PENDING",
        "A.M_CONFIRMED",
        "R.M_CONFIRMED",
        "N.S.M_CONFIRMED",
        "A.C_CONFIRMED",
        "IN_SHIPPING",
        "DELIVERED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    approvalLogs: {
      type: [ApprovalLogSchema],
      default: [],
    },

    deliveryManId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    deliveryDate: { type: Date },

    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "SalesInvoice",
    },

    isInvoiced: { type: Boolean, default: false },

    notes: { type: String },

    isActive: { type: Boolean, default: true },

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

SalesOrderSchema.index({ orderNo: 1 });
SalesOrderSchema.index({ customerId: 1 });
SalesOrderSchema.index({ status: 1 });
SalesOrderSchema.index({ orderDate: -1 });

export default mongoose.models.SalesOrder ||
  mongoose.model<ISalesOrder>("SalesOrder", SalesOrderSchema);
