import mongoose, { Schema, Document } from "mongoose";

export interface IWarehouseOrFactory extends Document {
  name: string;
  code: string;

  address?: {
    zone?: mongoose.Types.ObjectId;
    region?: mongoose.Types.ObjectId;
    areas?: mongoose.Types.ObjectId[];
    territories?: mongoose.Types.ObjectId[];
  };

  type: "Factory" | "Warehouse";

  assignedUsers: mongoose.Types.ObjectId[];
  status: string;
  createdBy?: mongoose.Types.ObjectId;
  notes?: string;
}

const warehouseSchema = new Schema<IWarehouseOrFactory>(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },

    // ✅ NESTED ADDRESS STRUCTURE
    address: {
      zone: { type: Schema.Types.ObjectId, ref: "Zone" },
      region: { type: Schema.Types.ObjectId, ref: "Region" },
      areas: [{ type: Schema.Types.ObjectId, ref: "Area" }],
      territories: [{ type: Schema.Types.ObjectId, ref: "Territory" }],
    },

    type: { type: String, enum: ["Factory", "Warehouse"], required: true },

    assignedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],

    status: { type: String, default: "Active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
  },
  { timestamps: true },
);

export default mongoose.models.WarehouseOrFactory ||
  mongoose.model<IWarehouseOrFactory>("WarehouseOrFactory", warehouseSchema);
