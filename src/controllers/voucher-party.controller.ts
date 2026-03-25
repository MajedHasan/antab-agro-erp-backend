import { createCrudController } from "./crud.controller";
import { voucherPartyService } from "../services/voucher-party.service";

export const voucherPartyController = createCrudController(voucherPartyService);
