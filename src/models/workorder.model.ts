import mongoose from "mongoose";

const workOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    description: String,

    quantity: { type: Number, required: true },
    unit: { type: String },

    unitPrice: { type: Number, required: true, default: 0 },
    lineTotal: { type: Number, required: true, default: 0 },

    remarks: { type: String },
  },
  { _id: true }
);

const workOrderSchema = new mongoose.Schema(
  {
    workOrderNo: { type: String, unique: true },

    dealer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dealer",
      required: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    issueDate: { type: Date, required: true },
    expectedDeliveryDate: { type: Date },

    items: { type: [workOrderItemSchema], required: true },

    // New calculated totals
    subTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Pending", "Processing", "Completed", "Cancelled"],
      default: "Pending",
    },

    notes: { type: String },

    // NEW: Terms & Conditions
    terms: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto generate Work Order No (existing logic remains)
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
      if (match && match[1]) nextNumber = parseInt(match[1]) + 1;
    }

    this.workOrderNo = `${prefix}${String(nextNumber).padStart(4, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

// Calculate totals
workOrderSchema.pre("save", function (next) {
  let sub = 0;

  this.items.forEach((item) => {
    item.lineTotal = item.quantity * item.unitPrice;
    sub += item.lineTotal;
  });

  this.subTotal = sub;
  this.taxTotal = 0; // future expansion
  this.grandTotal = sub;

  next();
});

export default mongoose.models.WorkOrder ||
  mongoose.model("WorkOrder", workOrderSchema);
