import mongoose, { Document, Schema } from "mongoose";

export interface IPasswordResetToken {
  token: string;
  user: mongoose.Types.ObjectId;
  expiresAt: Date;
  used?: boolean;
  createdAt?: Date;
}

export interface IPasswordResetTokenDoc extends IPasswordResetToken, Document {}

const PasswordResetTokenSchema = new Schema<IPasswordResetTokenDoc>(
  {
    token: { type: String, required: true, index: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetTokenModel = mongoose.model<IPasswordResetTokenDoc>(
  "PasswordResetToken",
  PasswordResetTokenSchema
);
