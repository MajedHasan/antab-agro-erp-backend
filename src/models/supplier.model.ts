import { Schema, model, Types } from "mongoose";

const supplierSchema = new Schema(
  {
    supplierName: { type: String, required: true, trim: true },
    ownerName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },

    groupType: { type: String, trim: true }, // Buying Type
    contactPersonDesignation: { type: String, trim: true },

    email: { type: String, trim: true },

    ownerPhone: { type: String, trim: true },
    contactPersonPhone: { type: String, trim: true },

    address: { type: String },

    // ---- File Fields (Media IDs) ----
    tinFile: { type: Types.ObjectId, ref: "Media" },
    binFile: { type: Types.ObjectId, ref: "Media" },
    nidFile: { type: Types.ObjectId, ref: "Media" },
    tradeLicenseFile: { type: Types.ObjectId, ref: "Media" },

    // Soft delete
    deletedAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

export const Supplier = model("Supplier", supplierSchema);
