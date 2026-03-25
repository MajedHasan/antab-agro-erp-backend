// src/services/dealer.service.ts
import DealerModel from "../models/dealer.model";
import { createCrudService } from "./crud.service";
import { accountService } from "./account.service";
import { mediaService } from "./media.service";

/* =========================================================
   BASE CRUD
========================================================= */

const base = createCrudService(DealerModel, {
  defaultPopulate: [
    "zone",
    "region",
    "area",
    "territory",
    "assignedSalesManager",
    "warehouse",
    "accountId",

    // 🔥 Populate Media attachments
    "attachments.required.bankCheque",
    "attachments.required.tradeLicense",
    "attachments.required.nidCard",
    "attachments.required.informationDeed",
    "attachments.required.pesticideLicense",
    "attachments.optional.agreements",
    "attachments.optional.others",
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

  /* =====================================================
     AFTER CREATE → AUTO ACCOUNT
  ====================================================== */
  afterCreate: async (doc: any) => {
    if (!doc?._id) return doc;

    try {
      // call the extended service method (idempotent)
      await dealerService.createAutoAccountForDealer(doc._id.toString());
    } catch (err) {
      console.error("Auto dealer account creation failed:", err);
    }

    return doc;
  },

  /* =====================================================
     AFTER UPDATE → SYNC ACCOUNT NAME
  ====================================================== */
  afterUpdate: async (doc: any) => {
    if (!doc?._id) return;

    try {
      await dealerService.syncAccountName(doc._id.toString());
    } catch (err) {
      console.error("Dealer account sync failed:", err);
    }
  },

  /* =====================================================
     BEFORE DELETE
     - Delete all linked media
     - Deactivate linked account
  ====================================================== */
  beforeDelete: async (id: string) => {
    const dealer = await DealerModel.findById(id).lean<any>();
    if (!dealer) return;

    const attachments = dealer.attachments || {
      required: {},
      optional: { agreements: [], others: [] },
    };

    /* =========================
       🔥 DELETE REQUIRED MEDIA
    ========================== */
    if (attachments.required) {
      for (const key of Object.keys(attachments.required)) {
        const mediaId = attachments.required[key];
        if (mediaId) {
          try {
            await mediaService.delete(mediaId.toString(), {
              hard: true,
            });
          } catch (err) {
            console.error(`Failed to delete required attachment [${key}]`, err);
          }
        }
      }
    }

    /* =========================
       🔥 DELETE OPTIONAL MEDIA
    ========================== */
    if (attachments.optional) {
      for (const key of Object.keys(attachments.optional)) {
        const mediaIds: string[] = attachments.optional[key] || [];

        for (const mediaId of mediaIds) {
          if (!mediaId) continue;

          try {
            await mediaService.delete(mediaId.toString(), {
              hard: true,
            });
          } catch (err) {
            console.error(`Failed to delete optional attachment [${key}]`, err);
          }
        }
      }
    }

    /* =====================================================
       🔥 Deactivate linked account (do NOT delete ledger)
    ====================================================== */
    if (dealer.accountId) {
      await accountService
        .update(dealer.accountId.toString(), {
          status: "Inactive",
        })
        .catch(() => {});
    }
  },
});

/* =========================================================
   EXTENDED DEALER SERVICE
========================================================= */

export const dealerService = {
  ...base,

  /* =====================================================
     AUTO ACCOUNT CREATION
     - robust, idempotent.
     - uses accountService.createAutoAccountForEntity when needed
  ====================================================== */
  async createAutoAccountForDealer(dealerId: string) {
    if (!dealerId) return;

    // load dealer
    const dealer = await DealerModel.findById(dealerId).lean<any>();
    if (!dealer) return;

    // if already linked, nothing to do (but ensure name is synced)
    if (dealer.accountId) {
      // still ensure account name is up-to-date
      try {
        await accountService.update(String(dealer.accountId), {
          name: dealer.name,
        });
      } catch (err) {
        // non-fatal
      }
      return;
    }

    const systemKey = `dealer:${String(dealer._id)}`;

    // 1) Try to find existing account by systemKey
    let account: any = null;
    try {
      account = await (accountService as any).findOne({
        systemKey,
        deletedAt: { $exists: false },
      });
    } catch (err) {
      // ignore, will create below
      account = null;
    }

    // 2) If not found, call createAutoAccountForEntity to ensure parent hierarchy and create the account
    if (!account) {
      try {
        account = await (accountService as any).createAutoAccountForEntity({
          entityType: "Dealer",
          entityId: String(dealer._id),
          name: dealer.name,
        });
      } catch (err) {
        console.error(
          "Failed to create auto account for dealer via accountService.createAutoAccountForEntity:",
          err,
        );
        // fallback: try naive create (keeps compatibility) — but still include metadata
        try {
          account = await accountService.create({
            name: dealer.name,
            code: `DLR-${dealer.code || dealer._id}`,
            type: "Asset",
            category: "Accounts Receivable",
            status: "Active",
            metadata: { entityType: "Dealer", entityId: dealer._id },
          });
        } catch (err2) {
          console.error("Fallback account creation also failed:", err2);
          return;
        }
      }
    } else {
      // ensure name up-to-date
      if (account.name !== dealer.name) {
        try {
          await accountService.update(String(account._id || account.id), {
            name: dealer.name,
          });
        } catch {
          // ignore
        }
      }
    }

    // 3) If account exists but has no parent (bad historical state), attempt to re-parent under Accounts Receivable
    try {
      const accParent = account.parent;
      const hasParent = !!(accParent && String(accParent).length);
      if (!hasParent) {
        const ar = await (accountService as any).findOne({
          systemKey: "coa_accounts_receivable",
          deletedAt: { $exists: false },
        });
        if (ar && ar._id) {
          try {
            await accountService.update(String(account._id || account.id), {
              parent: String(ar._id),
            });
            // refresh account variable
            account = await (accountService as any).getById(
              String(account._id || account.id),
            );
          } catch (err) {
            // changing parent might fail if constraints; ignore
            console.warn(
              "Could not re-parent dealer account under Accounts Receivable:",
              err,
            );
          }
        }
      }
    } catch (err) {
      // ignore re-parent errors
    }

    // 4) Link account to dealer record (use findByIdAndUpdate in case of concurrent updates)
    try {
      const accId = account._id ? account._id : account.id;
      if (accId) {
        await DealerModel.findByIdAndUpdate(
          dealerId,
          { $set: { accountId: accId } },
          { new: true },
        ).exec();
      }
    } catch (err) {
      console.error("Failed to link dealer -> accountId:", err);
    }
  },

  /* =====================================================
     ACCOUNT NAME SYNC
  ====================================================== */
  async syncAccountName(dealerId: string) {
    if (!dealerId) return;
    const dealer = await DealerModel.findById(dealerId).lean<any>();
    if (!dealer) return;

    // If dealer has accountId, update that account
    if ((dealer as any).accountId) {
      try {
        await accountService.update((dealer as any).accountId.toString(), {
          name: dealer.name,
        });
      } catch (err) {
        // ignore
      }
      return;
    }

    // If no accountId saved, attempt to find by systemKey and update
    const systemKey = `dealer:${String(dealer._id)}`;
    try {
      const acc = await (accountService as any).findOne({
        systemKey,
        deletedAt: { $exists: false },
      });
      if (acc && acc._id) {
        await accountService.update(String(acc._id), { name: dealer.name });
        // ensure dealer linked to this account for future
        await DealerModel.findByIdAndUpdate(dealerId, {
          $set: { accountId: acc._id },
        }).catch(() => {});
      }
    } catch (err) {
      // ignore
    }
  },

  /* =====================================================
     GENERATE DEALER CODE
  ====================================================== */
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

    const firstLetter = (s?: string) =>
      !s ? "X" : s.trim()[0]?.toUpperCase() || "X";

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

    if (existing?.length) {
      const match = (existing[0].code || "").match(regex);
      if (match?.[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${initials}${nextNumber}`;
  },
};
