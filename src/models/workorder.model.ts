import mongoose from "mongoose";

/* =========================================================
   WORK ORDER ITEM
========================================================= */
const workOrderItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["RawMaterial", "PackagingItem"],
      required: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "items.itemType",
    },

    description: String,

    quantity: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
    },

    unitPrice: {
      type: Number,
      default: 0,
    },

    lineTotal: {
      type: Number,
      default: 0,
    },

    remarks: String,
  },
  { _id: true },
);

/* =========================================================
   WORK ORDER SCHEMA
========================================================= */
const workOrderSchema = new mongoose.Schema(
  {
    workOrderNo: { type: String, unique: true },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    warehouseOrFactory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    issueDate: {
      type: Date,
      required: true,
    },

    expectedDeliveryDate: {
      type: Date,
    },

    items: {
      type: [workOrderItemSchema],
      required: true,
    },

    /* =====================================================
       🔥 TRACK RECEIVED QUANTITY (FROM GR)
    ====================================================== */
    receivedQuantity: {
      type: Number,
      default: 0,
    },

    /* =====================================================
       🔥 PROGRESS (AUTO CALCULATED)
    ====================================================== */
    progress: {
      type: Number,
      default: 0,
    },

    /* =====================================================
       CALCULATED TOTALS
    ====================================================== */
    subTotal: {
      type: Number,
      default: 0,
    },

    taxTotal: {
      type: Number,
      default: 0,
    },

    grandTotal: {
      type: Number,
      default: 0,
    },

    /* =====================================================
       STATUS
    ====================================================== */
    status: {
      type: String,
      enum: ["Pending", "Processing", "Approved", "Completed", "Cancelled"],
      default: "Pending",
    },

    /* =====================================================
       🔥 CANCEL / REJECT AUDIT
    ====================================================== */

    cancelReason: {
      type: String,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledAt: {
      type: Date,
    },

    rejectReason: {
      type: String,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    rejectedAt: {
      type: Date,
    },

    /* =====================================================
       EXTRA INFO
    ====================================================== */
    notes: {
      type: String,
    },

    terms: {
      type: String,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

/* =========================================================
   AUTO GENERATE WORK ORDER NO
========================================================= */
workOrderSchema.pre("validate", async function (next) {
  try {
    if (this.workOrderNo) return next();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const prefix = `WO-${year}${month}-`;
    const regex = new RegExp(`^${prefix}(\\d+)$`);

    const existing = await mongoose
      .model("WorkOrder")
      .find({ workOrderNo: regex })
      .sort({ workOrderNo: -1 })
      .limit(1)
      .lean();

    let nextNumber = 1;

    if (existing.length) {
      const match = existing[0].workOrderNo.match(regex);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    this.workOrderNo = `${prefix}${String(nextNumber).padStart(4, "0")}`;

    next();
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   CALCULATE TOTALS + PROGRESS BEFORE SAVE
========================================================= */
workOrderSchema.pre("save", function (next) {
  let sub = 0;

  this.items.forEach((item: any) => {
    item.lineTotal = item.quantity * item.unitPrice;
    sub += item.lineTotal;
  });

  this.subTotal = sub;
  this.taxTotal = 0;
  this.grandTotal = sub;

  /* =====================================================
     UPDATE PROGRESS BASED ON RECEIVED QUANTITY
  ====================================================== */

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

/* =========================================================
   EXPORT
========================================================= */
export default mongoose.models.WorkOrder ||
  mongoose.model("WorkOrder", workOrderSchema);
