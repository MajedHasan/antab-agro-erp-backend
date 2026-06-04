import mediaModel, { IMedia } from "../models/media.model";
import { deleteFile } from "../utils/deleteFile.util";
import { createCrudService } from "./crud.service";

export const mediaService = createCrudService<IMedia>(mediaModel, {
  softDeleteField: "deletedAt",
  searchFields: ["originalName", "fileType", "module", "folder"],
  allowedFilterFields: ["module", "folder", "fileType"],

  // runs on both soft or hard delete
  async afterDelete(doc) {
    if (!doc) return;
    try {
      await deleteFile(doc.url); // make sure deleteFile resolves absolute path
    } catch (err) {
      console.error("Failed to delete media file from disk", doc.url, err);
    }
  },
});
