import mongoose, { Schema, Document } from "mongoose";

export interface IWarehouseOrFactory extends Document {
  name: string;
  code: string;
  address?: string;
  type: "Factory" | "Warehouse";

  assignedUsers: mongoose.Types.ObjectId[]; // ← important
  status: string;
  createdBy?: mongoose.Types.ObjectId;
  notes?: string;
}

const warehouseSchema = new Schema<IWarehouseOrFactory>(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },

    address: { type: String },
    type: { type: String, enum: ["Factory", "Warehouse"], required: true },

    assignedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],

    status: { type: String, default: "Active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Warehouse ||
  mongoose.model<IWarehouseOrFactory>("WarehouseOrFactory", warehouseSchema);
