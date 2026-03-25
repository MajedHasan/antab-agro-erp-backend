import { createCrudController } from "./crud.controller";
import { journalVoucherTypeService } from "../services/journal-voucher-type.service";

export const journalVoucherTypeController = createCrudController(
  journalVoucherTypeService,
);
