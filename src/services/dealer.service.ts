// src/services/dealer.service.ts
import DealerModel from "../models/dealer.model";
import { createCrudService } from "./crud.service";
import fs from "fs";
import path from "path";

const base = createCrudService(DealerModel, {
  defaultPopulate: [
    "zone",
    "region",
    "area",
    "territory",
    "assignedSalesManager",
    "warehouse",
  ],
  searchFields: ["name", "code", "proprietor", "email", "phoneNumber"],
  allowedFilterFields: [
    "zone",
    "region",
    "area",
    "territory",
    "status",
    "warehouse",
  ],

  beforeDelete: async (id: string) => {
    const dealer = await DealerModel.findById(id).lean();
    if (!dealer) return;

    const attachments = dealer.attachments || {
      required: {},
      optional: { agreements: [], others: [] },
    };

    // Required files
    for (const key in attachments.required) {
      const filePath = attachments.required[key];
      if (filePath) {
        try {
          fs.unlinkSync(path.join(process.cwd(), filePath.replace(/^\/+/, "")));
        } catch (err) {
          console.error(err);
        }
      }
    }

    // Optional files
    for (const key of Object.keys(attachments.optional)) {
      for (const file of attachments.optional[key]) {
        if (file) {
          try {
            fs.unlinkSync(path.join(process.cwd(), file.replace(/^\/+/, "")));
          } catch (err) {
            console.error(err);
          }
        }
      }
    }
  },
});

export const dealerService = {
  ...base,

  /**
   * Delete all uploaded files of a dealer from filesystem before deleting DB record
   */
  async beforeDelete(id: string) {
    // Fetch dealer as plain object
    const dealer = await base.model.findById(id).lean<any>();
    if (!dealer) return;

    const attachments = dealer.attachments || {
      required: {},
      optional: { agreements: [], others: [] },
    };

    // Delete required attachments
    if (attachments.required) {
      for (const key of Object.keys(attachments.required)) {
        const filePath = path.join(
          process.cwd(),
          attachments.required[key].replace(/^\/+/, "")
        );
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete required attachment [${key}]:`, err);
        }
      }
    }

    // Delete optional attachments
    if (attachments.optional) {
      for (const key of Object.keys(attachments.optional)) {
        const files: string[] = attachments.optional[key] || [];
        for (const file of files) {
          const filePath = path.join(process.cwd(), file.replace(/^\/+/, ""));
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch (err) {
            console.error(
              `Failed to delete optional attachment [${key}]:`,
              err
            );
          }
        }
      }
    }
  },

  /**
   * Generate dealer code
   */
  async generateCode({
    zone,
    region,
    area,
    territory,
  }: {
    zone?: string;
    region?: string;
    area?: string;
    territory?: string;
  }) {
    const conn = (base.model as any).db;
    const Zone = conn.model("Zone");
    const Region = conn.model("Region");
    const Area = conn.model("Area");
    const Territory = conn.model("Territory");

    const [zn, rn, an, tn] = await Promise.all([
      zone
        ? Zone.findById(zone)
            .select("name")
            .lean()
            .exec()
            .catch(() => null)
        : null,
      region
        ? Region.findById(region)
            .select("name")
            .lean()
            .exec()
            .catch(() => null)
        : null,
      area
        ? Area.findById(area)
            .select("name")
            .lean()
            .exec()
            .catch(() => null)
        : null,
      territory
        ? Territory.findById(territory)
            .select("name")
            .lean()
            .exec()
            .catch(() => null)
        : null,
    ]);

    const firstLetter = (s?: string) => (!s ? "X" : s.trim()[0].toUpperCase());

    const initials =
      firstLetter(zn?.name) +
      firstLetter(rn?.name) +
      firstLetter(an?.name) +
      firstLetter(tn?.name);

    const regex = new RegExp(`^${initials}(\\d+)$`);

    const existing = await base.model
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

    return `${initials}${nextNumber}`;
  },
};
