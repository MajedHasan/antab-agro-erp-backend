// models/user.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: mongoose.Types.ObjectId;
  department?: string; // optional if you want explicit department on User
  restricted?: boolean;
  profileImageUrl?: string;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    department: { type: String },
    restricted: { type: Boolean, default: false },
    profileImageUrl: String,
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
