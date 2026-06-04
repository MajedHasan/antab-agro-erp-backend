import mongoose, { Schema } from "mongoose";

const commissionSchema = new Schema(
  {
    mode: {
      type: String,
      enum: ["FIXED", "PERCENT"],
      required: true,
      default: "FIXED",
      trim: true,
    },

    /**
     * User-entered commission input.
     * - If mode = FIXED   => this is the fixed amount
     * - If mode = PERCENT => this is the percentage value (example: 10 for 10%)
     */
    value: {
      type: Number,
      required: true,
      min: 0,
    },

    /**
     * Final calculated commission amount.
     * This should be calculated in service layer and stored here.
     */
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const moneyReceiptSchema = new Schema(
  {
    mrNo: {
      type: String,
      required: true,
      trim: true,
    },

    mrDate: {
      type: Date,
      required: true,
    },

    /**
     * Gross collected amount for this MR
     */
    taka: {
      type: Number,
      required: true,
      min: 0,
    },

    deductCommission: {
      type: Boolean,
      default: false,
    },

    /**
     * Commission can now be fixed or percentage based
     */
    commission: {
      type: commissionSchema,
      required: true,
    },

    /**
     * Same MR can be reused across invoices.
     * Only one occurrence needs media.
     * Validation will happen in service layer.
     */
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      default: null,
    },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesInvoice",
      required: true,
    },

    invoiceNo: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Each invoice must contain one or multiple MRs.
     * Duplicate MR inside same invoice is NOT allowed.
     * Validation will happen in service layer.
     */
    moneyReceipts: {
      type: [moneyReceiptSchema],
      default: [],
    },
  },
  { _id: false },
);

const dealerSchema = new Schema(
  {
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dealer",
      required: true,
    },

    dealerName: {
      type: String,
      required: true,
      trim: true,
    },

    invoices: {
      type: [invoiceSchema],
      default: [],
    },
  },
  { _id: false },
);

const onlineCopySchema = new Schema(
  {
    onlineCopyNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    onlineCopyDate: {
      type: Date,
      required: true,
    },

    /**
     * Gross online copy amount
     */
    onlineCopyTaka: {
      type: Number,
      required: true,
      min: 0,
    },

    /**
     * Bank deposit charge
     */
    bankDepositCharge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VoucherAccount",
      required: true,
    },

    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      required: true,
    },
  },
  { _id: false },
);

const workflowLogSchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "HOLD",
        "DISPUTED",
        "CANCELLED",
      ],
      required: true,
    },

    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    at: {
      type: Date,
      default: Date.now,
      required: true,
    },

    remarks: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false },
);

const summarySchema = new Schema(
  {
    totalDealers: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalInvoices: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMoneyReceipts: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMRAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Total calculated commission amount
     */
    totalCommission: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDeductCommission: {
      // ← NEW FIELD
      type: Number,
      default: 0,
      min: 0,
    },

    bankDepositCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const collectionSchema = new Schema(
  {
    voucherNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    date: {
      type: Date,
      default: Date.now,
      required: true,
    },

    dealers: {
      type: [dealerSchema],
      default: [],
    },

    onlineCopy: {
      type: onlineCopySchema,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "HOLD",
        "DISPUTED",
        "CANCELLED",
      ],
      default: "SUBMITTED",
      index: true,
    },

    workflowLogs: {
      type: [workflowLogSchema],
      default: [],
    },

    summary: {
      type: summarySchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Indexes
 */
collectionSchema.index({ "dealers.dealerId": 1 });
collectionSchema.index({ "dealers.invoices.invoiceId": 1 });
collectionSchema.index({ "dealers.invoices.moneyReceipts.mrNo": 1 });
collectionSchema.index({ status: 1, createdAt: -1 });
collectionSchema.index({ createdAt: -1 });

export default mongoose.models.Collection ||
  mongoose.model("Collection", collectionSchema);
