import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
});

const Zone = mongoose.models.Zone || mongoose.model("Zone", zoneSchema);

export default Zone;
