import { Schema, model } from "mongoose";

export type VoucherPartyDirection = "Receive" | "Payment";

const VoucherPartySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    direction: {
      type: String,
      enum: ["Receive", "Payment"],
      required: true,
      index: true,
    },

    voucherTypes: {
      type: [String],
      required: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

/* Prevent duplicate names per direction */
VoucherPartySchema.index({ name: 1, direction: 1 }, { unique: true });

export const VoucherParty = model("VoucherParty", VoucherPartySchema);
