import { Schema, model } from "mongoose";

const PaymentModeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    voucherTypes: {
      type: [String],
      required: true,
      index: true,
    },

    requiresReference: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

export const PaymentMode = model("PaymentMode", PaymentModeSchema);
