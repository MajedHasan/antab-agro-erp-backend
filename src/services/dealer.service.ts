import DealerModel from "../models/dealer.model";
import { createCrudService } from "./crud.service";
import { accountService } from "./account.service";
import { mediaService } from "./media.service";

type DealerStatus = "Pending" | "Active" | "Blocked";

type DealerCreditSummary = {
  dealerId: string;
  dealerType: "CASH" | "CREDIT";
  creditLimit: number;
  currentDue: number;
  available: number;
  canUseCredit: boolean;
};

type GenerateCodeInput = {
  zone?: string;
  region?: string;
  area?: string;
  territory?: string;
};

const base = createCrudService(DealerModel, {
  defaultPopulate: [
    "zone",
    "region",
    "area",
    "territory",
    "assignedSalesManager",
    "warehouse",
    "accountId",
    "attachments.required.bankCheque",
    "attachments.required.tradeLicense",
    "attachments.required.nidCard",
    "attachments.required.informationDeed",
    "attachments.required.pesticideLicense",
    "attachments.required.signature",
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
  afterCreate: async (doc: any) => {
    if (!doc?._id) return doc;

    try {
      await dealerService.createAutoAccountForDealer(String(doc._id));
    } catch (err) {
      console.error("Auto dealer account creation failed:", err);
    }

    return doc;
  },
  afterUpdate: async (doc: any) => {
    if (!doc?._id) return doc;

    try {
      await dealerService.syncAccountName(String(doc._id));
    } catch (err) {
      console.error("Dealer account sync failed:", err);
    }

    return doc;
  },
  beforeDelete: async (id: string) => {
    const dealer = await DealerModel.findById(id).lean().exec();
    if (!dealer) return;

    const attachments = (dealer as any).attachments || {
      required: {},
      optional: { agreements: [], others: [] },
    };

    if (attachments.required) {
      for (const key of Object.keys(attachments.required)) {
        const mediaId = attachments.required[key];
        if (!mediaId) continue;

        try {
          await mediaService.delete(String(mediaId), { hard: true });
        } catch (err) {
          console.error(`Failed to delete required attachment [${key}]`, err);
        }
      }
    }

    if (attachments.optional) {
      for (const key of Object.keys(attachments.optional)) {
        const mediaIds: string[] = attachments.optional[key] || [];

        for (const mediaId of mediaIds) {
          if (!mediaId) continue;

          try {
            await mediaService.delete(String(mediaId), { hard: true });
          } catch (err) {
            console.error(`Failed to delete optional attachment [${key}]`, err);
          }
        }
      }
    }

    if ((dealer as any).accountId) {
      try {
        await accountService.update(String((dealer as any).accountId), {
          status: "Inactive",
        });
      } catch {
        // ignore
      }
    }
  },
});

export const dealerService = {
  ...base,

  async assertDealerActive(dealerId: string) {
    const dealer = await DealerModel.findById(dealerId).lean().exec();
    if (!dealer) {
      throw new Error("Dealer not found");
    }

    if ((dealer as any).status === "Blocked") {
      throw new Error("Dealer is blocked");
    }

    return dealer;
  },

  async getCreditSummary(dealerId: string): Promise<DealerCreditSummary> {
    const dealer = await DealerModel.findById(dealerId).lean().exec();
    if (!dealer) {
      throw new Error("Dealer not found");
    }

    const creditLimit = Number((dealer as any).creditLimit || 0);
    const currentDue = Number((dealer as any).currentDue || 0);
    const available = creditLimit - currentDue;
    const dealerType = ((dealer as any).type || "CASH") as "CASH" | "CREDIT";

    return {
      dealerId: String((dealer as any)._id),
      dealerType,
      creditLimit,
      currentDue,
      available,
      canUseCredit: dealerType === "CREDIT" && available > 0,
    };
  },

  async validateCredit(dealerId: string, amount: number) {
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new Error("amount must be a positive number");
    }

    const summary = await this.getCreditSummary(dealerId);
    const amountNumber = Number(amount);

    return {
      ...summary,
      requestedAmount: amountNumber,
      canUseCredit:
        summary.dealerType === "CREDIT" && summary.available >= amountNumber,
    };
  },

  async getSignatureTemplate(dealerId: string) {
    const dealer = await DealerModel.findById(dealerId)
      .populate("attachments.required.signature")
      .lean()
      .exec();

    if (!dealer) {
      throw new Error("Dealer not found");
    }

    const signature = (dealer as any)?.attachments?.required?.signature || null;

    return {
      dealerId: String((dealer as any)._id),
      signature,
    };
  },

  async updateSignatureTemplate(dealerId: string, mediaId: string) {
    if (!mediaId) {
      throw new Error("mediaId is required");
    }

    const Media = DealerModel.db.model("Media");
    const media = await Media.findById(mediaId).lean().exec();
    if (!media) {
      throw new Error("Media file not found");
    }

    const updated = await DealerModel.findByIdAndUpdate(
      dealerId,
      {
        $set: {
          "attachments.required.signature": mediaId,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate(base.model.schema.options?.populate || undefined)
      .exec();

    if (!updated) {
      throw new Error("Dealer not found");
    }

    return updated;
  },

  async updateCreditLimit(dealerId: string, creditLimit: number) {
    const value = Number(creditLimit);

    if (Number.isNaN(value) || value < 0) {
      throw new Error("creditLimit must be a valid non-negative number");
    }

    const updated = await DealerModel.findByIdAndUpdate(
      dealerId,
      { $set: { creditLimit: value } },
      { new: true, runValidators: true },
    ).exec();

    if (!updated) {
      throw new Error("Dealer not found");
    }

    return updated;
  },

  async updateCurrentDue(dealerId: string, currentDue: number) {
    const value = Number(currentDue);

    if (Number.isNaN(value) || value < 0) {
      throw new Error("currentDue must be a valid non-negative number");
    }

    const updated = await DealerModel.findByIdAndUpdate(
      dealerId,
      { $set: { currentDue: value } },
      { new: true, runValidators: true },
    ).exec();

    if (!updated) {
      throw new Error("Dealer not found");
    }

    return updated;
  },

  async createAutoAccountForDealer(dealerId: string) {
    if (!dealerId) return;

    const dealer = await DealerModel.findById(dealerId).lean().exec();
    if (!dealer) return;

    if ((dealer as any).accountId) {
      try {
        await accountService.update(String((dealer as any).accountId), {
          name: (dealer as any).name,
        });
      } catch {
        // ignore
      }
      return;
    }

    const systemKey = `dealer:${String((dealer as any)._id)}`;

    let account: any = null;

    try {
      account = await (accountService as any).findOne({
        systemKey,
        deletedAt: { $exists: false },
      });
    } catch {
      account = null;
    }

    if (!account) {
      try {
        account = await (accountService as any).createAutoAccountForEntity({
          entityType: "Dealer",
          entityId: String((dealer as any)._id),
          name: (dealer as any).name,
        });
      } catch (err) {
        console.error(
          "Failed to create auto account for dealer via accountService.createAutoAccountForEntity:",
          err,
        );

        try {
          account = await accountService.create({
            name: (dealer as any).name,
            code: `DLR-${(dealer as any).code || (dealer as any)._id}`,
            type: "Asset",
            category: "Accounts Receivable",
            status: "Active",
            metadata: {
              entityType: "Dealer",
              entityId: (dealer as any)._id,
            },
          });
        } catch (err2) {
          console.error("Fallback account creation also failed:", err2);
          return;
        }
      }
    } else {
      if (account.name !== (dealer as any).name) {
        try {
          await accountService.update(String(account._id || account.id), {
            name: (dealer as any).name,
          });
        } catch {
          // ignore
        }
      }
    }

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

            account = await (accountService as any).getById(
              String(account._id || account.id),
            );
          } catch (err) {
            console.warn(
              "Could not re-parent dealer account under Accounts Receivable:",
              err,
            );
          }
        }
      }
    } catch {
      // ignore
    }

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

  async syncAccountName(dealerId: string) {
    if (!dealerId) return;

    const dealer = await DealerModel.findById(dealerId).lean().exec();
    if (!dealer) return;

    if ((dealer as any).accountId) {
      try {
        await accountService.update(String((dealer as any).accountId), {
          name: (dealer as any).name,
        });
      } catch {
        // ignore
      }
      return;
    }

    const systemKey = `dealer:${String((dealer as any)._id)}`;

    try {
      const acc = await (accountService as any).findOne({
        systemKey,
        deletedAt: { $exists: false },
      });

      if (acc && acc._id) {
        await accountService.update(String(acc._id), {
          name: (dealer as any).name,
        });

        await DealerModel.findByIdAndUpdate(dealerId, {
          $set: { accountId: acc._id },
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  },

  async generateCode({ zone, region, area, territory }: GenerateCodeInput) {
    const conn = DealerModel.db;
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

    const first = (s?: string) =>
      !s ? "X" : s.trim()[0]?.toUpperCase() || "X";

    const initials =
      first((zn as any)?.name) +
      first((rn as any)?.name) +
      first((an as any)?.name) +
      first((tn as any)?.name);

    const regex = new RegExp(`^${initials}(\\d+)$`);

    const existing = await DealerModel.find({ code: regex })
      .select("code")
      .sort({ code: -1 })
      .limit(1)
      .lean()
      .exec();

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
