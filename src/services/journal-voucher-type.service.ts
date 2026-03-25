import { createCrudService } from "./crud.service";
import { JournalVoucherType } from "../models/journal-voucher-type.model";

export const journalVoucherTypeService = createCrudService(JournalVoucherType, {
  defaultSort: "name",
  searchFields: ["name"],
  allowedFilterFields: ["isActive", "isSystem"],
});
