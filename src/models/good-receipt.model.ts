import mongoose from "mongoose";

/* =========================================================
   GR ITEM
========================================================= */
const grItemSchema = new mongoose.Schema(
  {
    workOrderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },

    itemType: {
      type: String,
      enum: ["RawMaterial", "PackagingItem", "FinishedProduct", "OtherProduct"],
      required: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "items.itemType",
    },

    receivedQty: {
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

    /* =====================================================
       TRANSPORT COST PER PRODUCT
    ====================================================== */

    transportCost: {
      type: Number,
      default: 0,
    },

    transportPaymentSource: {
      type: String,
      enum: ["Pending", "Factory", "HeadOffice", "Supplier"],
      default: "Pending",
    },

    /* LINK TO PAYMENT VOUCHER (OPTIONAL) */
    transportVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
    },

    lineTotal: {
      type: Number,
      default: 0,
    },
  },
  { _id: true },
);

/* =========================================================
   PAYMENT HISTORY
========================================================= */
const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },

    method: {
      type: String,
    },

    reference: {
      type: String,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: true },
);

/* =========================================================
   GOODS RECEIPT SCHEMA
========================================================= */
const goodsReceiptSchema = new mongoose.Schema(
  {
    grNo: {
      type: String,
      unique: true,
    },

    /* =====================================================
       OPTIONAL LINK TO WORK ORDER
    ====================================================== */
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkOrder",
    },

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
      default: Date.now,
    },

    /* =====================================================
       ITEMS
    ====================================================== */
    items: {
      type: [grItemSchema],
      required: true,
    },

    /* =====================================================
       FILE ATTACHMENTS
    ====================================================== */
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
      },
    ],

    /* =====================================================
       FINANCIAL FIELDS
    ====================================================== */

    subTotal: {
      type: Number,
      default: 0,
    },

    taxTotal: {
      type: Number,
      default: 0,
    },

    transportationNotes: {
      type: String,
    },

    grandTotal: {
      type: Number,
      default: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
    },

    remainingAmount: {
      type: Number,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partial", "Paid"],
      default: "Unpaid",
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    /* =====================================================
       STATUS
    ====================================================== */

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    rejectedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
    },

    /* =====================================================
       META
    ====================================================== */

    createdBy: {
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
   AUTO GENERATE GR NUMBER
========================================================= */
goodsReceiptSchema.pre("validate", async function (next) {
  try {
    if (this.grNo) return next();

    const prefix = "GR-";
    const regex = new RegExp(`^${prefix}(\\d+)$`);

    const existing = await mongoose
      .model("GoodsReceipt")
      .find({ grNo: regex })
      .sort({ grNo: -1 })
      .limit(1)
      .lean();

    let nextNumber = 1;

    if (existing.length) {
      const match = existing[0].grNo?.match(regex);
      if (match?.[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    this.grNo = `${prefix}${String(nextNumber).padStart(5, "0")}`;

    next();
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   CALCULATE TOTALS + PAYMENT STATUS
========================================================= */
goodsReceiptSchema.pre("save", async function (next) {
  let sub = 0;
  let transportTotal = 0;

  if (this.workOrderId) {
    const WorkOrder = mongoose.model("WorkOrder");
    const workOrder = await WorkOrder.findById(this.workOrderId).lean();

    const priceMap = new Map();

    if (workOrder?.items) {
      for (const woItem of workOrder.items) {
        priceMap.set(woItem.itemId.toString(), Number(woItem.unitPrice || 0));
      }
    }

    for (const item of this.items) {
      if (!item.unitPrice || item.unitPrice === 0) {
        const priceFromWO = priceMap.get(item.itemId.toString()) || 0;
        item.unitPrice = priceFromWO;
      }

      item.lineTotal =
        Number(item.receivedQty || 0) * Number(item.unitPrice || 0);

      sub += item.lineTotal;

      transportTotal += Number(item.transportCost || 0);

      /* AUTO SET FACTORY IF COST ENTERED */
      if (item.transportCost > 0 && item.transportPaymentSource === "Pending") {
        item.transportPaymentSource = "Factory";
      }
    }
  } else {
    for (const item of this.items) {
      item.lineTotal =
        Number(item.receivedQty || 0) * Number(item.unitPrice || 0);

      sub += item.lineTotal;

      transportTotal += Number(item.transportCost || 0);

      if (item.transportCost > 0 && item.transportPaymentSource === "Pending") {
        item.transportPaymentSource = "Factory";
      }
    }
  }

  this.subTotal = sub;
  this.taxTotal = 0;

  this.grandTotal = this.subTotal + this.taxTotal + transportTotal;

  this.paidAmount = this.payments.reduce((acc, p) => acc + (p.amount || 0), 0);

  this.remainingAmount = this.grandTotal - this.paidAmount;

  if (this.remainingAmount <= 0) {
    this.paymentStatus = "Paid";
  } else if (this.paidAmount > 0) {
    this.paymentStatus = "Partial";
  } else {
    this.paymentStatus = "Unpaid";
  }

  next();
});

/* =========================================================
   EXPORT
========================================================= */
export default mongoose.models.GoodsReceipt ||
  mongoose.model("GoodsReceipt", goodsReceiptSchema);
