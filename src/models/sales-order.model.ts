// src/models/sales-order.model.ts
import mongoose, { Schema, Document, Types, HydratedDocument } from "mongoose";

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
  role: "A.M" | "R.M" | "N.S.M" | "FULFILLMENT" | "DELIVERY";
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

  status:
    | "PENDING_AM"
    | "PENDING_RM"
    | "PENDING_NSM"
    | "PENDING_FULFILLMENT"
    | "IN_SHIPPING"
    | "DELIVERED"
    | "REJECTED"
    | "CANCELLED";

  approvalLogs: IApprovalLog[];

  paymentMethod: "CASH" | "CREDIT";

  creditSnapshot: {
    creditLimit: number;
    used: number;
    available: number;
  };

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

  /* ======================
     Delivery Chalan (DC)
  ======================= */
  dcMediaId?: Types.ObjectId;        // 🆕 reference to the uploaded DC file
  dcUploadedBy?: Types.ObjectId;     // 🆕 who uploaded the DC
  dcUploadedAt?: Date;               // 🆕 when the DC was uploaded

  notes?: string;
  isActive: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

type SalesOrderDoc = HydratedDocument<ISalesOrder>;

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
      enum: ["A.M", "R.M", "N.S.M", "FULFILLMENT", "DELIVERY"],
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
        "PENDING_AM",
        "PENDING_RM",
        "PENDING_NSM",
        "PENDING_FULFILLMENT",
        "IN_SHIPPING",
        "DELIVERED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING_AM",
    },

    approvalLogs: {
      type: [ApprovalLogSchema],
      default: [],
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "CREDIT"],
      required: true,
    },

    creditSnapshot: {
      _id: false,
      creditLimit: {
        type: Number,
        required: function (this: SalesOrderDoc) {
          return this.paymentMethod === "CREDIT";
        },
        default: 0,
      },
      used: {
        type: Number,
        required: function (this: SalesOrderDoc) {
          return this.paymentMethod === "CREDIT";
        },
        default: 0,
      },
      available: {
        type: Number,
      },
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

    // 🆕 Delivery Chalan fields
    dcMediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
    },
    dcUploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    dcUploadedAt: {
      type: Date,
    },

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
SalesOrderSchema.index({ paymentMethod: 1 });

SalesOrderSchema.pre("validate", function (next) {
  if (this.paymentMethod === "CREDIT" && this.creditSnapshot) {
    const { creditLimit = 0, used = 0 } = this.creditSnapshot;
    this.creditSnapshot.available = creditLimit - used;
  }
  next();
});

export default mongoose.models.SalesOrder ||
  mongoose.model<ISalesOrder>("SalesOrder", SalesOrderSchema);