import { Schema, model } from "mongoose";

const JournalVoucherTypeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    isSystem: {
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

export const JournalVoucherType = model(
  "JournalVoucherType",
  JournalVoucherTypeSchema,
);
