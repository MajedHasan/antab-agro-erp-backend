import mongoose from "mongoose";

// Territory
const territorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  area: { type: mongoose.Schema.Types.ObjectId, ref: "Area", required: true },
  description: { type: String },
});

const Territory =
  mongoose.models.Territory || mongoose.model("Territory", territorySchema);

export default Territory;
