// models/session.model.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISession extends Document {
  user: mongoose.Types.ObjectId;
  jti: string; // id of refresh token or session id
  userAgent?: string;
  ip?: string;
  lastActiveAt: Date;
  createdAt: Date;
  revokedAt?: Date | null;
}

const SessionSchema = new Schema<ISession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jti: { type: String, required: true, index: true, unique: true },
    userAgent: { type: String },
    ip: { type: String },
    lastActiveAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const SessionModel: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);
export default SessionModel;
