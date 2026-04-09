import mongoose from "mongoose";

/* =========================================================
   CONSTANTS (SINGLE SOURCE OF TRUTH)
========================================================= */

export const WORK_ORDER_ITEM_TYPES = [
  "RawMaterial",
  "PackagingItem",
  "Product",
  "OtherProducts",
] as const;

export const WORK_ORDER_STATUSES = [
  "Pending",
  "Processing",
  "UnderReview", // ✅ NEW STAGE
  "Approved",
  "Completed",
  "Cancelled",
] as const;

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["UnderReview", "Cancelled"],
  UnderReview: ["Approved", "Cancelled"],
  Approved: ["Completed"],
  Completed: [],
  Cancelled: [],
};

/* =========================================================
   WORK ORDER ITEM SCHEMA
========================================================= */

const workOrderItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: WORK_ORDER_ITEM_TYPES,
      required: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "itemType", // ✅ dynamic model reference
    },

    name: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      trim: true,
    },

    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    lineTotal: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
    timestamps: false,
  },
);

/* =========================================================
   MAIN WORK ORDER SCHEMA
========================================================= */

const workOrderSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */

    workOrderNo: {
      type: String,
      unique: true,
      index: true,
    },

    subject: String,
    reference: String,
    attention: String,
    salutation: String,

    /* ================= RELATIONS ================= */

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },

    warehouseOrFactory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
      index: true,
    },

    /* ================= DATES ================= */

    issueDate: {
      type: Date,
      required: true,
    },

    expectedDeliveryDate: Date,

    /* ================= ITEMS ================= */

    items: {
      type: [workOrderItemSchema],
      required: true,
      validate: [(arr: any[]) => arr.length > 0, "At least one item required"],
    },

    /* ================= TOTALS ================= */

    subTotal: { type: Number, default: 0 },

    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    taxPercent: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },

    grandTotal: { type: Number, default: 0 },

    /* ================= RECEIVING TRACK ================= */

    receivedQuantity: {
      type: Number,
      default: 0,
    },

    progress: {
      type: Number,
      default: 0,
    },

    /* ================= STATUS ================= */

    status: {
      type: String,
      enum: WORK_ORDER_STATUSES,
      default: "Pending",
      index: true,
    },

    /* ================= AUDIT ================= */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /* ================= CANCEL / REJECT ================= */

    cancelReason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: Date,

    rejectReason: String,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: Date,

    /* ================= EXTRA ================= */

    notes: String,
    terms: String,
    footerNote: String,

    /* ================= SOFT DELETE ================= */

    deletedAt: Date,
  },
  {
    timestamps: true,
  },
);

/* =========================================================
   AUTO GENERATE WORK ORDER NUMBER
========================================================= */

workOrderSchema.pre("validate", async function (next) {
  try {
    if (this.workOrderNo) return next();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const prefix = `WO-${year}${month}-`;
    const regex = new RegExp(`^${prefix}(\\d+)$`);

    const last = await mongoose
      .model("WorkOrder")
      .find({ workOrderNo: regex })
      .sort({ workOrderNo: -1 })
      .limit(1)
      .lean();

    let nextNumber = 1;

    if (last.length) {
      const match = last[0].workOrderNo.match(regex);
      if (match?.[1]) nextNumber = parseInt(match[1]) + 1;
    }

    this.workOrderNo = `${prefix}${String(nextNumber).padStart(4, "0")}`;

    next();
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   CALCULATE TOTALS + PROGRESS
========================================================= */

workOrderSchema.pre("save", function (next) {
  let subTotal = 0;

  this.items.forEach((item: any) => {
    item.lineTotal = item.quantity * item.unitPrice;
    subTotal += item.lineTotal;
  });

  const discountPercent = this.discountPercent || 0;
  const taxPercent = this.taxPercent || 0;

  const discountAmount = (subTotal * discountPercent) / 100;
  const afterDiscount = subTotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const grandTotal = afterDiscount + taxAmount;

  this.subTotal = subTotal;
  this.discountAmount = discountAmount;
  this.taxTotal = taxAmount;
  this.grandTotal = grandTotal;

  /* ===== PROGRESS ===== */

  const totalOrderedQty = this.items.reduce(
    (acc: number, item: any) => acc + item.quantity,
    0,
  );

  if (totalOrderedQty > 0) {
    this.progress = Math.min(
      100,
      Math.round((this.receivedQuantity / totalOrderedQty) * 100),
    );
  } else {
    this.progress = 0;
  }

  next();
});

workOrderSchema.pre("save", async function (next) {
  if (!this.isModified("status")) return next();

  if (this.isNew) return next();

  try {
    // Fetch previous value from DB
    const prevDoc = await mongoose
      .model("WorkOrder")
      .findById(this._id)
      .lean()
      .select("status");

    const prevStatus = prevDoc?.status || null;
    const newStatus = this.status;

    const allowed = VALID_STATUS_TRANSITIONS[prevStatus] || [];

    if (!allowed.includes(newStatus)) {
      return next(
        new Error(`Invalid status transition: ${prevStatus} → ${newStatus}`),
      );
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   EXPORT MODEL
========================================================= */

export default mongoose.models.WorkOrder ||
  mongoose.model("WorkOrder", workOrderSchema);
