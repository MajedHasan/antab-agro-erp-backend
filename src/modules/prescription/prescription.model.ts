const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      enum: ["MR", "MS"],
      required: true,
    },

    farmerName: {
      type: String,
      required: true,
      trim: true,
    },

    farmerMobile: {
      type: String,
      required: true,
      trim: true,
    },

    cropName: {
      type: String,
      required: true,
      trim: true,
    },

    pestTypeName: {
      type: String,
      required: true,
      trim: true,
    },

    solutionName: {
      type: String,
      required: true,
      trim: true,
    },

    doseName: {
      type: String,
      required: true,
      trim: true,
    },

    previewMessageBn: {
      type: String,
      required: true,
    },

    smsStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Prescription", prescriptionSchema);
