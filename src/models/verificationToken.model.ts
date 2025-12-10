import mongoose, { Document, Schema } from "mongoose";

export interface IVerificationToken {
  token: string;
  user: mongoose.Types.ObjectId;
  expiresAt: Date;
  used?: boolean;
  createdAt?: Date;
}

export interface IVerificationTokenDoc extends IVerificationToken, Document {}

const VerificationTokenSchema = new Schema<IVerificationTokenDoc>(
  {
    token: { type: String, required: true, index: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationTokenModel = mongoose.model<IVerificationTokenDoc>(
  "VerificationToken",
  VerificationTokenSchema
);
