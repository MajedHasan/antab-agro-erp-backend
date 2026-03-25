import { createCrudService } from "./crud.service";
import { VoucherAccount } from "../models/voucher-account.model";

export const voucherAccountService = createCrudService(VoucherAccount, {
  defaultPopulate: {
    path: "accountId",
    select: "name type code balance",
  },
  allowedFilterFields: [
    "role",
    "isActive",
    "allowedVoucherTypes",
    "side",
    "accountId",
  ],
});
