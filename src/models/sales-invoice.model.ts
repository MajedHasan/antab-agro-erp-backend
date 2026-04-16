import mongoose, { Schema, Document, Types } from "mongoose";

/* ======================================
   Invoice Item Interface
====================================== */

export interface ISalesInvoiceItem {
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

/* ======================================
   Payment Interface
====================================== */

export interface IInvoicePayment {
  method: "CASH" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "CREDIT";
  amount: number;
  paymentDate?: Date;
  referenceNo?: string;
  receivedBy?: Types.ObjectId;
}

/* ======================================
   Main Invoice Interface
====================================== */

export interface ISalesInvoice extends Document {
  invoiceNo: string;

  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  warehouseId: Types.ObjectId;

  invoiceDate: Date;
  dueDate?: Date;

  items: ISalesInvoiceItem[];

  subTotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;

  totalBonusQty: number;

  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";

  paidAmount: number;
  balanceAmount: number;

  payments: IInvoicePayment[];

  status: "ACTIVE" | "CANCELLED" | "REFUNDED";

  notes?: string;

  qrCode: string;
  signedInvoice?: Types.ObjectId; // file path or media id
  isVerified: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/* ======================================
   Invoice Item Schema
====================================== */

const SalesInvoiceItemSchema = new Schema<ISalesInvoiceItem>(
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

    qty: { type: Number, required: true, min: 0 },
    bonusQty: { type: Number, default: 0, min: 0 },

    unitPrice: { type: Number, required: true, min: 0 },

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

/* ======================================
   Payment Schema
====================================== */

const InvoicePaymentSchema = new Schema<IInvoicePayment>(
  {
    method: {
      type: String,
      enum: ["CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "CREDIT"],
      required: true,
    },

    amount: { type: Number, required: true, min: 0 },

    paymentDate: { type: Date, default: Date.now },

    referenceNo: { type: String },

    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: false },
);

/* ======================================
   Main Invoice Schema
====================================== */

const SalesInvoiceSchema = new Schema<ISalesInvoice>(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
    },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
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

    invoiceDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: { type: Date },

    items: {
      type: [SalesInvoiceItemSchema],
      required: true,
    },

    subTotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    totalBonusQty: { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
    },

    paidAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, required: true },

    payments: {
      type: [InvoicePaymentSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED", "REFUNDED"],
      default: "ACTIVE",
    },

    notes: { type: String },

    qrCode: {
      type: String,
      index: true,
    },

    signedInvoice: {
      type: Schema.Types.ObjectId, // file path or media id
      ref: "Media",
    },

    isVerified: {
      type: Boolean,
      default: false,
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

/* ======================================
   Indexes (Important for ERP speed)
====================================== */

SalesInvoiceSchema.index({ invoiceNo: 1 });
SalesInvoiceSchema.index({ orderId: 1 });
SalesInvoiceSchema.index({ customerId: 1 });
SalesInvoiceSchema.index({ invoiceDate: -1 });
SalesInvoiceSchema.index({ paymentStatus: 1, status: 1 });

SalesInvoiceSchema.pre("save", function (next) {
  this.balanceAmount = this.grandTotal - this.paidAmount;
  next();
});

export default mongoose.models.SalesInvoice ||
  mongoose.model<ISalesInvoice>("SalesInvoice", SalesInvoiceSchema);
