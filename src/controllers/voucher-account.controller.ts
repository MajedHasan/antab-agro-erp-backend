import { createCrudController } from "./crud.controller";
import { voucherAccountService } from "../services/voucher-account.service";

export const voucherAccountController = createCrudController(
  voucherAccountService,
);
