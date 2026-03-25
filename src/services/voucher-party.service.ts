import { createCrudService } from "./crud.service";
import { VoucherParty } from "../models/voucher-party.model";

export const voucherPartyService = createCrudService(VoucherParty, {
  defaultSort: "sortOrder name",
  searchFields: ["name"],
  allowedFilterFields: ["direction", "isActive", "voucherTypes"],
});
