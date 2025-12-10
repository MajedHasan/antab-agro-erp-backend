// src/models/userLocationAccess.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IUserLocationAccess extends Document {
  user: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  access: {
    zone: mongoose.Types.ObjectId;
    regions: {
      region: mongoose.Types.ObjectId;
      areas: {
        area: mongoose.Types.ObjectId;
        territories: mongoose.Types.ObjectId[];
      }[];
    }[];
  };
}

const UserLocationAccessSchema = new Schema<IUserLocationAccess>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    access: {
      zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true },

      regions: [
        {
          region: {
            type: Schema.Types.ObjectId,
            ref: "Region",
            required: true,
          },
          areas: [
            {
              area: {
                type: Schema.Types.ObjectId,
                ref: "Area",
                required: true,
              },
              territories: [{ type: Schema.Types.ObjectId, ref: "Territory" }],
            },
          ],
        },
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUserLocationAccess>(
  "UserLocationAccess",
  UserLocationAccessSchema
);
