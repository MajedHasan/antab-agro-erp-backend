import { Supplier } from "../models/supplier.model";
import { createCrudService } from "./crud.service";
import { accountService } from "./account.service";
import { mediaService } from "./media.service";

/* =========================================================
   BASE CRUD
========================================================= */

const base = createCrudService(Supplier, {
  softDeleteField: "deletedAt",

  defaultPopulate: [
    "accountId",
    { path: "tinFile" },
    { path: "binFile" },
    { path: "nidFile" },
    { path: "tradeLicenseFile" },
  ],

  searchFields: [
    "supplierName",
    "ownerName",
    "contactPerson",
    "email",
    "ownerPhone",
    "contactPersonPhone",
    "groupType",
  ],

  allowedFilterFields: [
    "supplierName",
    "ownerName",
    "contactPerson",
    "email",
    "ownerPhone",
    "contactPersonPhone",
    "groupType",
  ],

  /* =====================================================
     AFTER CREATE → AUTO ACCOUNT
  ====================================================== */
  afterCreate: async (doc: any) => {
    if (!doc?._id) return doc;

    try {
      await supplierService.createAutoAccountForSupplier(doc._id.toString());
    } catch (err) {
      console.error("Auto supplier account creation failed:", err);
    }

    return doc;
  },

  /* =====================================================
     AFTER UPDATE → SYNC ACCOUNT NAME
  ====================================================== */
  afterUpdate: async (doc: any) => {
    if (!doc?._id) return;

    try {
      await supplierService.syncAccountName(doc._id.toString());
    } catch (err) {
      console.error("Supplier account sync failed:", err);
    }
  },

  /* =====================================================
     BEFORE DELETE
     - Delete linked media
     - Deactivate linked account
  ====================================================== */
  beforeDelete: async (id: string) => {
    const supplier = await Supplier.findById(id).lean<any>();
    if (!supplier) return;

    /* =========================
       🔥 DELETE MEDIA FILES
    ========================== */
    const fileIds = [
      supplier.tinFile,
      supplier.binFile,
      supplier.nidFile,
      supplier.tradeLicenseFile,
    ].filter(Boolean);

    for (const fileId of fileIds) {
      try {
        await mediaService.delete(fileId.toString(), { hard: true });
      } catch (err) {
        console.error("Failed to delete supplier file:", err);
      }
    }

    /* =====================================================
       🔥 Deactivate linked account (do NOT delete)
    ====================================================== */
    if (supplier.accountId) {
      await accountService
        .update(supplier.accountId.toString(), {
          status: "Inactive",
        })
        .catch(() => {});
    }
  },
});

/* =========================================================
   EXTENDED SUPPLIER SERVICE
========================================================= */

export const supplierService = {
  ...base,

  /* =====================================================
     AUTO ACCOUNT CREATION
     - idempotent
     - parent: Accounts Payable
  ====================================================== */
  async createAutoAccountForSupplier(supplierId: string) {
    if (!supplierId) return;

    const supplier = await Supplier.findById(supplierId).lean<any>();
    if (!supplier) return;

    // If already linked → just sync name
    if (supplier.accountId) {
      try {
        await accountService.update(String(supplier.accountId), {
          name: supplier.supplierName,
        });
      } catch {}
      return;
    }

    const systemKey = `supplier:${String(supplier._id)}`;

    // 1️⃣ Try to find existing account by systemKey
    let account: any = null;
    try {
      account = await (accountService as any).findOne({
        systemKey,
        deletedAt: { $exists: false },
      });
    } catch {
      account = null;
    }

    // 2️⃣ If not found → create using central auto system
    if (!account) {
      try {
        account = await (accountService as any).createAutoAccountForEntity({
          entityType: "Supplier",
          entityId: String(supplier._id),
          name: supplier.supplierName,
        });
      } catch (err) {
        console.error(
          "Failed to create auto account via accountService.createAutoAccountForEntity:",
          err,
        );

        // fallback (safe compatibility mode)
        try {
          account = await accountService.create({
            name: supplier.supplierName,
            code: `SUP-${supplier._id}`,
            type: "Liability",
            category: "Accounts Payable",
            status: "Active",
            metadata: {
              entityType: "Supplier",
              entityId: supplier._id,
            },
          });
        } catch (err2) {
          console.error("Fallback supplier account creation failed:", err2);
          return;
        }
      }
    } else {
      // ensure name updated
      if (account.name !== supplier.supplierName) {
        try {
          await accountService.update(String(account._id || account.id), {
            name: supplier.supplierName,
          });
        } catch {}
      }
    }

    // 3️⃣ Link account to supplier
    try {
      const accId = account._id ? account._id : account.id;
      if (accId) {
        await Supplier.findByIdAndUpdate(
          supplierId,
          { $set: { accountId: accId } },
          { new: true },
        ).exec();
      }
    } catch (err) {
      console.error("Failed to link supplier -> accountId:", err);
    }
  },

  /* =====================================================
     ACCOUNT NAME SYNC
  ====================================================== */
  async syncAccountName(supplierId: string) {
    if (!supplierId) return;

    const supplier = await Supplier.findById(supplierId).lean<any>();
    if (!supplier) return;

    if (supplier.accountId) {
      try {
        await accountService.update(supplier.accountId.toString(), {
          name: supplier.supplierName,
        });
      } catch {}
      return;
    }

    // fallback: try find by systemKey
    const systemKey = `supplier:${String(supplier._id)}`;

    try {
      const acc = await (accountService as any).findOne({
        systemKey,
        deletedAt: { $exists: false },
      });

      if (acc && acc._id) {
        await accountService.update(String(acc._id), {
          name: supplier.supplierName,
        });

        await Supplier.findByIdAndUpdate(supplierId, {
          $set: { accountId: acc._id },
        }).catch(() => {});
      }
    } catch {}
  },
};
