import { Schema, model, Types } from "mongoose";

export type StatementType =
  | "Balance Sheet"
  | "Income Statement"
  | "Cash Flow"
  | "Equity Statement"
  | "Notes";

const relatedAccountSchema = new Schema(
  {
    account: {
      type: Types.ObjectId,
      ref: "Account",
      required: true,
    },
    snapshotBalance: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const noteVersionSchema = new Schema(
  {
    versionNo: { type: Number, required: true },
    content: { type: String, required: true },
    author: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const financialNoteSchema = new Schema(
  {
    noteNo: { type: String, required: true },
    title: { type: String, required: true },
    statement: {
      type: String,
      enum: [
        "Balance Sheet",
        "Income Statement",
        "Cash Flow",
        "Equity Statement",
        "Notes",
      ],
      required: true,
    },
    year: { type: Number, required: true },

    summary: { type: String },

    relatedAccounts: [relatedAccountSchema],

    versions: {
      type: [noteVersionSchema],
      validate: [(v: any[]) => v.length > 0, "At least one version required"],
    },

    isDraft: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

financialNoteSchema.index(
  { noteNo: 1, year: 1, statement: 1 },
  { unique: true },
);

export const FinancialNote = model("FinancialNote", financialNoteSchema);
