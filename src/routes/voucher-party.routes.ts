import { createCrudRouter } from "./crud.routes";
import { voucherPartyController } from "../controllers/voucher-party.controller";

export default createCrudRouter(voucherPartyController);
