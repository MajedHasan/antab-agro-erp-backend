import { Schema, model, Types } from "mongoose";

export type VoucherAccountRole = "Bank" | "Cash" | "Ledger";

const VoucherAccountSchema = new Schema(
  {
    accountId: {
      type: Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
      unique: true,
    },

    role: {
      type: String,
      enum: ["Bank", "Cash", "Ledger"],
      required: true,
      index: true,
    },

    allowedVoucherTypes: {
      type: [String],
      required: true,
      index: true,
    },

    side: {
      type: String,
      enum: ["Debit", "Credit"],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

/* Prevent same account being duplicated */
VoucherAccountSchema.index({ accountId: 1 }, { unique: true });

export const VoucherAccount = model("VoucherAccount", VoucherAccountSchema);
