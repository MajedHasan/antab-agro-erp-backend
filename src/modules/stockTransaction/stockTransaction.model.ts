import mongoose, { Schema } from "mongoose";

const batchDetailSchema = new Schema(
  {
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "StockTransaction",
      required: true,
    },
    quantity: { type: Number, required: true, set: (v: any) => parseFloat(v) },
    unitCost: { type: Number, required: true, set: (v: any) => parseFloat(v) },
    totalCost: { type: Number, required: true, set: (v: any) => parseFloat(v) },
  },
  { _id: false },
);

const stockTransactionSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: ["RawMaterial", "PackagingItem", "Product", "OtherProducts"],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },
    transactionType: {
      type: String,
      enum: [
        "purchase",
        "consumption",
        "transfer_in",
        "transfer_out",
        "sale",
        "return",
        "wastage",
        "adjustment",
        "reservation", // marks a reservation (stores batchDetails)
        "reservation_release", // optional fulfillment marker
        "production",
        "production_return"
      ],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      set: (v: any) => parseFloat(v),
      // positive = in (purchase, return, transfer_in)
      // negative = out (consumption, sale, transfer_out, wastage)
    },
    // For purchase batches – tracks how much is still available for consumption/reservation
    remainingQuantity: { type: Number, default: 0, set: (v: any) => parseFloat(v) },
    // For purchase batches – tracks how much is currently reserved (but not yet consumed)
    reserved: { type: Number, default: 0, set: (v: any) => parseFloat(v) },
    unitCost: { type: Number, required: true, set: (v: any) => parseFloat(v) },
    totalCost: { type: Number, required: true, set: (v: any) => parseFloat(v) },
    sourceId: { type: Schema.Types.ObjectId },
    sourceModel: { type: String },
    batch: { type: String },
    // Stores the exact batch breakdown for reservation transactions
    batchDetails: [batchDetailSchema],
    transactionDate: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Indexes for LIFO/FIFO queries
stockTransactionSchema.index({
  itemType: 1,
  itemId: 1,
  locationId: 1,
  transactionDate: -1,
});
stockTransactionSchema.index({ sourceId: 1, sourceModel: 1 });

// ────────────────────────────────────────────────────────
// 🔥 Auto‑set remainingQuantity for incoming stock
// ────────────────────────────────────────────────────────
const INCOMING_TYPES = ["purchase", "production_return", "transfer_in"];

stockTransactionSchema.pre("save", function (next) {
  const doc = this as any; // fix TS "implicit any" error

  if (
    INCOMING_TYPES.includes(doc.transactionType) &&
    (doc.remainingQuantity === undefined || doc.remainingQuantity === null)
  ) {
    doc.remainingQuantity = doc.quantity;
  }
  next();
});

export const StockTransaction =
  mongoose.models.StockTransaction ||
  mongoose.model("StockTransaction", stockTransactionSchema);
