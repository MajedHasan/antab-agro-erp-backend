// src/models/financial-note.model.ts
import { Schema, model, Types } from "mongoose";

export type StatementType =
  | "Balance Sheet"
  | "Income Statement"
  | "Cash Flow"
  | "Equity Statement"
  | "Notes";

export type NoteType =
  | "BASIS_OF_PREPARATION"
  | "ACCOUNTING_POLICY"
  | "TABULAR"          // numeric table only
  | "MOVEMENT"         // opening → additions → disposals → closing
  | "AGING"            // receivables/payables aging buckets
  | "NARRATIVE"
  | "SUBSEQUENT_EVENT"
  | "RELATED_PARTY";

/* ---------- Sub-schemas ---------- */

const relatedAccountSchema = new Schema(
  {
    account: { type: Types.ObjectId, ref: "Account", required: true },
    // ── identity snapshot (survives renames/deletes) ──
    accountCode: { type: String },
    accountName: { type: String },
    // ── rollup metadata ──
    isParentRollup: { type: Boolean, default: false },
    // leaf account IDs that were auto-included under this parent
    rolledUpLeaves: [
      {
        account: { type: Types.ObjectId, ref: "Account" },
        code: String,
        name: String,
        snapshotBalance: Number,
      },
    ],
    // ── balances ──
    snapshotBalance: { type: Number, default: 0 },
    // optional current balance comes from live ledger, not stored
  },
  { _id: false },
);

const noteSectionSchema = new Schema(
  {
    heading: { type: String, trim: true },
    body: { type: String, default: "" }, // markdown
    kind: {
      type: String,
      enum: ["NARRATIVE", "BULLETS", "TABLE", "SUB_NOTE"],
      default: "NARRATIVE",
    },
    tableData: { type: Schema.Types.Mixed }, // for embedded tables
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const noteVersionSchema = new Schema(
  {
    versionNo: { type: Number, required: true },
    content: { type: String, default: "" }, // legacy single-blob content
    sections: { type: [noteSectionSchema], default: [] },
    summary: { type: String },
    author: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    kind: {
      type: String,
      enum: ["CREATED", "UPDATED", "FINALISED", "REORDERED", "RELINKED"],
      default: "UPDATED",
    },
  },
  { _id: true },
);

/* ---------- Main schema ---------- */

const financialNoteSchema = new Schema(
  {
    noteNo: { type: String, required: true },        // "Note 4"
    displayOrder: { type: Number, required: true, default: 1 },

    title: { type: String, required: true, trim: true },
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
    noteType: {
      type: String,
      enum: [
        "BASIS_OF_PREPARATION",
        "ACCOUNTING_POLICY",
        "TABULAR",
        "MOVEMENT",
        "AGING",
        "NARRATIVE",
        "SUBSEQUENT_EVENT",
        "RELATED_PARTY",
      ],
      default: "TABULAR",
    },
    year: { type: Number, required: true },
    summary: { type: String, trim: true },

    // ── cross-reference to the face line this note explains ──
    statementRef: {
      // e.g. "Trade Receivables" — the exact line text on the BS/IS
      lineItem: { type: String },
      // optional exact account code that ties to the face line
      accountCode: { type: String },
    },

    // ── linked accounts (hierarchy-aware, rolled up) ──
    relatedAccounts: { type: [relatedAccountSchema], default: [] },

    // ── content structure ──
    sections: { type: [noteSectionSchema], default: [] },

    // ── version history ──
    versions: {
      type: [noteVersionSchema],
      validate: [(v: any[]) => v.length > 0, "At least one version required"],
    },

    // ── workflow ──
    isDraft: { type: Boolean, default: true },
    finalisedAt: { type: Date },
    finalisedBy: { type: String },

    // ── optional parent (sub-notes: 5.1 under 5) ──
    parentNoteId: {
      type: Types.ObjectId,
      ref: "FinancialNote",
      default: null,
    },

    // ── template origin (so you can "clone from PPE template") ──
    templateKey: { type: String },

    deletedAt: { type: Date },
  },
  { timestamps: true },
);

financialNoteSchema.index({ year: 1, statement: 1, displayOrder: 1 });
financialNoteSchema.index({ year: 1, statement: 1, noteNo: 1 });
financialNoteSchema.index({ deletedAt: 1 });

export const FinancialNote = model("FinancialNote", financialNoteSchema);