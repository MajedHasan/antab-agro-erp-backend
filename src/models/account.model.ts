import { Schema, model, Types } from "mongoose";

const accountSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"],
      required: true,
    },
    category: { type: String, trim: true },
    parent: { type: Types.ObjectId, ref: "Account", default: null },

    // NOTE: leaving balance in schema as cache only.
    // Do NOT rely on it for reports — ledger (VoucherLine) is authoritative.
    balance: { type: Number, default: 0 },

    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    description: { type: String, trim: true },
    taxType: { type: String }, // optional for Revenue
    deletedAt: { type: Date, default: undefined }, // soft delete

    systemKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },

    // Profit & Loss grouping
    plGroup: {
      type: String,
      enum: [
        "revenue",
        "costOfSales",
        "selling",
        "admin",
        "nonOperating",
        "financeCost",
        "tax",
      ],
      default: undefined,
      trim: true,
    },
  },
  { timestamps: true },
);

export const Account = model("Account", accountSchema);
