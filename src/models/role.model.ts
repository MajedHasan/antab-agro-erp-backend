// models/role.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IRole extends Document {
  name: string; // e.g. "Marketing Manager"
  department?: string; // optional: "Marketing"
  permissions: mongoose.Types.ObjectId[]; // names like ["invoice.create","campaign.edit"]
  inherits?: mongoose.Types.ObjectId[]; // other roles this role inherits from
  isSystem?: boolean; // true for Super Admin
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true },
    department: { type: String },
    permissions: [
      { type: Schema.Types.ObjectId, ref: "Permission" }, // <-- link
    ], // store permission names for simplicity
    inherits: [{ type: Schema.Types.ObjectId, ref: "Role" }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IRole>("Role", RoleSchema);
