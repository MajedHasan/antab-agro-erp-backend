// models/permission.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IPermission extends Document {
  name: string; // e.g. "invoice.create"
  description?: string;
}

const PermissionSchema = new Schema<IPermission>(
  {
    name: { type: String, required: true, unique: true, index: true },
    description: String,
  },
  { timestamps: true }
);

export default mongoose.model<IPermission>("Permission", PermissionSchema);
