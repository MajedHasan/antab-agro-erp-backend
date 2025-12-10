import mongoose, { Document, Schema } from "mongoose";

export interface IRefreshToken {
  jti: string; // unique id for rotation
  token: string;
  user: mongoose.Types.ObjectId;
  expiresAt: Date;
  replacedBy?: string | null; // jti of the token that replaced this one (rotation)
  revoked?: boolean;
  createdAt?: Date;
}

export interface IRefreshTokenDoc extends IRefreshToken, Document {}

const RefreshTokenSchema = new Schema<IRefreshTokenDoc>(
  {
    jti: { type: String, required: true, index: true, unique: true },
    token: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    replacedBy: { type: String, default: null },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// TTL to auto-delete expired docs
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<IRefreshTokenDoc>(
  "RefreshToken",
  RefreshTokenSchema
);
