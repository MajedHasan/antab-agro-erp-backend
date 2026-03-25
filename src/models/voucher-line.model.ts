import { Schema, model, Types } from "mongoose";

const VoucherLineSchema = new Schema(
  {
    voucherId: {
      type: Types.ObjectId,
      ref: "Voucher",
      required: true,
      index: true,
    },

    accountId: {
      type: Types.ObjectId,
      ref: "Account",
      required: true,
    },

    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },

    narration: { type: String, trim: true },
  },
  { timestamps: true },
);

export const VoucherLine = model("VoucherLine", VoucherLineSchema);
