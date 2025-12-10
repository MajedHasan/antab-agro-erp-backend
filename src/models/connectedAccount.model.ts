// models/connectedAccount.model.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IConnectedAccount extends Document {
  user: mongoose.Types.ObjectId;
  provider: string; // "google", "facebook", "github"
  providerId: string;
  profileData?: any; // optional raw provider profile
  createdAt: Date;
  updatedAt: Date;
}

const ConnectedAccountSchema = new Schema<IConnectedAccount>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: { type: String, required: true, index: true },
    providerId: { type: String, required: true },
    profileData: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ConnectedAccountSchema.index({ user: 1, provider: 1 }, { unique: true });

const ConnectedAccountModel: Model<IConnectedAccount> =
  mongoose.models.ConnectedAccount ||
  mongoose.model<IConnectedAccount>("ConnectedAccount", ConnectedAccountSchema);

export default ConnectedAccountModel;
