import { Schema, model, Types } from "mongoose";

const VoucherSchema = new Schema(
  {
    voucherNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "Journal",
        "Contra",
        "CashReceive",
        "BankReceive",
        "CashPayment",
        "BankPayment",
        "Opening",
      ],
      required: true,
      index: true,
    },

    reference: {
      type: String,
      trim: true,
    },

    narration: {
      type: String,
      trim: true,
    },

    /* =====================================================
       CORE ACCOUNTING METADATA
       ===================================================== */

    // 🔥 Generic source (party / ledger / entity)
    source: {
      type: Types.ObjectId,
      refPath: "sourceModel",
      index: true,
    },

    // Dynamic model reference for source
    sourceModel: {
      type: String,
      enum: [
        "VoucherParty",
        "Dealer",
        "Customer",
        "Supplier",
        "Account",
        "GoodsReceipt",
      ],
    },

    // 🔥 Payment / transaction mode
    mode: {
      type: Types.ObjectId,
      ref: "PaymentMode",
    },

    // Optional — link to dealer explicitly
    dealerId: {
      type: Types.ObjectId,
      ref: "Dealer",
      index: true,
    },

    // Optional — invoice linkage
    invoiceId: {
      type: Types.ObjectId,
      ref: "SalesInvoice",
      index: true,
    },

    // Support multiple invoices (future-proof)
    invoiceIds: [
      {
        type: Types.ObjectId,
        ref: "SalesInvoice",
      },
    ],

    // Bank ledger used (for BankReceive / BankPayment)
    bankVaId: {
      type: Types.ObjectId,
      ref: "VoucherAccount",
    },

    /* =====================================================
       WORKFLOW
       ===================================================== */

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },

    submittedBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    submittedAt: Date,

    approvedBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    rejectionReason: {
      type: String,
      trim: true,
    },

    rejectedBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    rejectedAt: Date,

    /* =====================================================
       AUDIT
       ===================================================== */

    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

/* =========================
   Indexes
========================= */
VoucherSchema.index({ date: 1, type: 1 });
VoucherSchema.index({ status: 1 });
VoucherSchema.index({ voucherNo: 1 });
VoucherSchema.index({ dealerId: 1 });
VoucherSchema.index({ invoiceId: 1 });
VoucherSchema.index({ source: 1 });

export const Voucher = model("Voucher", VoucherSchema);
