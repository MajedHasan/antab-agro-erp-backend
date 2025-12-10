import mongoose from "mongoose";

// Area
const areaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Region",
    required: true,
  },
  description: { type: String },
});

const Area = mongoose.models.Area || mongoose.model("Area", areaSchema);

export default Area;
