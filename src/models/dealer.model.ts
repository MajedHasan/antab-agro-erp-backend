// src/models/dealer.model.ts
import mongoose, { HydratedDocument } from "mongoose";

interface IDealer {
  type: "CASH" | "CREDIT";
}
type DealerDocument = HydratedDocument<IDealer>;
/**
 * Helper: get first letter of string (A-Z) fallback "X"
 */
function firstLetter(s?: string) {
  if (!s || typeof s !== "string") return "X";
  const t = s.trim();
  return t.length ? t[0].toUpperCase() : "X";
}

/**
 * Generate dealer code based on names of zone/region/area/territory.
 * Format: <Z><R><A><T><number>
 */
async function generateDealerCode(doc: any) {
  if (doc.code) return;

  const conn = mongoose.connection;
  const Zone = conn.model("Zone");
  const Region = conn.model("Region");
  const Area = conn.model("Area");
  const Territory = conn.model("Territory");

  const [zn, rn, an, tn] = await Promise.all([
    doc.zone
      ? Zone.findById(doc.zone)
          .select("name")
          .lean()
          .exec()
          .catch(() => null)
      : null,
    doc.region
      ? Region.findById(doc.region)
          .select("name")
          .lean()
          .exec()
          .catch(() => null)
      : null,
    doc.area
      ? Area.findById(doc.area)
          .select("name")
          .lean()
          .exec()
          .catch(() => null)
      : null,
    doc.territory
      ? Territory.findById(doc.territory)
          .select("name")
          .lean()
          .exec()
          .catch(() => null)
      : null,
  ]);

  const initials =
    firstLetter(zn?.name) +
    firstLetter(rn?.name) +
    firstLetter(an?.name) +
    firstLetter(tn?.name);

  const regex = new RegExp(`^${initials}(\\d+)$`);

  const existing = await mongoose
    .model("Dealer")
    .find({ code: regex })
    .select("code")
    .sort({ code: -1 })
    .limit(1)
    .lean();

  let nextNumber = 1;
  if (existing && existing.length) {
    const match = (existing[0].code || "").match(regex);
    if (match && match[1]) nextNumber = parseInt(match[1], 10) + 1;
  }

  doc.code = `${initials}${nextNumber}`;
}

const attachmentsSchema = new mongoose.Schema(
  {
    required: {
      bankCheque: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
        required: true,
      },
      tradeLicense: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
        required: true,
      },
      nidCard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
        required: true,
      },
      informationDeed: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
        required: true,
      },
      pesticideLicense: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
        required: true,
      },
      signature: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
        required: false,
      },
    },
    optional: {
      agreements: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Media",
        },
      ],
      others: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Media",
        },
      ],
    },
  },
  { _id: false },
);

const dealerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, unique: true }, // generated
    proprietor: { type: String, required: true },

    zone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    region: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Region",
      required: true,
    },
    area: { type: mongoose.Schema.Types.ObjectId, ref: "Area", required: true },
    territory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Territory",
      required: true,
    },

    type: {
      type: String,
      enum: ["CASH", "CREDIT"],
      required: true,
    },

    creditLimit: {
      type: Number,
      default: 0,
      validate: {
        validator: function (this: DealerDocument, v: number) {
          if (this.type === "CREDIT") return v > 0;
          return true;
        },
        message: "Credit dealer must have credit limit",
      },
    },

    currentDue: {
      type: Number,
      default: 0,
      min: 0,
    },

    openingBalance: { type: Number, default: 0 },

    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      unique: true,
      sparse: true,
    },

    phoneNumber: { type: String, required: true, unique: true },
    email: { type: String },
    address: { type: String },

    opDate: { type: String },
    opMonth: { type: String },

    // warehouse selectable (not required)
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Active", "Inactive", "Blocked"],
      default: "Pending",
    },

    notes: { type: String },

    lastPurchaseDate: { type: Date }, // optional

    attachments: {
      type: attachmentsSchema,
      default: () => ({
        required: {},
        optional: { agreements: [], others: [] },
      }),
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedSalesManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Pre-validate hook to generate code if missing
dealerSchema.pre("validate", async function (next) {
  try {
    await generateDealerCode(this);
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.models.Dealer || mongoose.model("Dealer", dealerSchema);
