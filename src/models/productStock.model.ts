import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * ==========================================================
 * Product Stock
 * Per Warehouse Stock Engine
 * ==========================================================
 */

export interface IProductStock extends Document {
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;

  quantity: number; // Physical stock

  reservedForSales: number;
  reservedForTransfer: number;

  incomingTransfer: number; // Approved transfer waiting to arrive

  unit: string;
  batch?: string;
  expiryDate?: Date;

  lastUpdated: Date;

  /**
   * Virtual Calculated Field
   */
  availableStock: number;

  /**
   * Helpers
   */
  reserveForSales(amount: number): Promise<void>;
  releaseSalesReservation(amount: number): Promise<void>;

  reserveForTransfer(amount: number): Promise<void>;
  releaseTransferReservation(amount: number): Promise<void>;
}

const ProductStockSchema = new Schema<IProductStock>(
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

    // ===============================
    // Physical Stock
    // ===============================
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ===============================
    // Reservations
    // ===============================
    reservedForSales: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservedForTransfer: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ===============================
    // Approved Transfer Waiting To Arrive
    // ===============================
    incomingTransfer: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      default: "pcs",
    },

    batch: String,

    expiryDate: Date,

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * ==========================================================
 * INDEX
 * ==========================================================
 */

ProductStockSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });

/**
 * ==========================================================
 * Virtual Field — Available Stock
 * ==========================================================
 */

ProductStockSchema.virtual("availableStock").get(function () {
  return this.quantity - this.reservedForSales - this.reservedForTransfer;
});

/**
 * ==========================================================
 * BUSINESS LOGIC METHODS
 * (Very Important For Clean Services)
 * ==========================================================
 */

ProductStockSchema.methods.reserveForSales = async function (amount: number) {
  if (this.availableStock < amount) {
    throw new Error("Not enough stock to reserve for sales");
  }

  this.reservedForSales += amount;
  this.lastUpdated = new Date();
  await this.save();
};

ProductStockSchema.methods.releaseSalesReservation = async function (
  amount: number,
) {
  this.reservedForSales = Math.max(0, this.reservedForSales - amount);

  this.lastUpdated = new Date();
  await this.save();
};

ProductStockSchema.methods.reserveForTransfer = async function (
  amount: number,
) {
  if (this.availableStock < amount) {
    throw new Error("Not enough stock to reserve for transfer");
  }

  this.reservedForTransfer += amount;
  this.lastUpdated = new Date();
  await this.save();
};

ProductStockSchema.methods.releaseTransferReservation = async function (
  amount: number,
) {
  this.reservedForTransfer = Math.max(0, this.reservedForTransfer - amount);

  this.lastUpdated = new Date();
  await this.save();
};

/**
 * ==========================================================
 * JSON SETTINGS
 * ==========================================================
 */

ProductStockSchema.set("toJSON", {
  virtuals: true,
});

ProductStockSchema.set("toObject", {
  virtuals: true,
});

export default mongoose.models.ProductStock ||
  mongoose.model<IProductStock>("ProductStock", ProductStockSchema);
