import { createCrudService } from "./crud.service";
import { Supplier } from "../models/supplier.model";
import { mediaService } from "./media.service";

export const supplierService = createCrudService(Supplier, {
  softDeleteField: "deletedAt",

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

  defaultPopulate: [
    { path: "tinFile" },
    { path: "binFile" },
    { path: "nidFile" },
    { path: "tradeLicenseFile" },
  ],

  // -------------- FIX: Delete files when supplier deleted --------------
  async beforeDelete(id) {
    const supplier = await Supplier.findById(id).lean();
    if (!supplier) return;

    // all media file references
    const fileIds = [
      supplier.tinFile,
      supplier.binFile,
      supplier.nidFile,
      supplier.tradeLicenseFile,
    ].filter(Boolean); // remove null/undefined

    // delete them from media + filesystem
    for (const fileId of fileIds) {
      try {
        await mediaService.remove(String(fileId), { hard: true });
      } catch (err) {
        console.error("Failed to delete supplier file:", fileId, err);
      }
    }
  },
});
