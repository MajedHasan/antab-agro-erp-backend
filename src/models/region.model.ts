import mongoose from "mongoose";

const regionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  description: { type: String },
});

const Region = mongoose.models.Region || mongoose.model("Region", regionSchema);

export default Region;
