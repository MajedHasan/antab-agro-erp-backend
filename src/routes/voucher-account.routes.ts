import { createCrudRouter } from "./crud.routes";
import { voucherAccountController } from "../controllers/voucher-account.controller";

export default createCrudRouter(voucherAccountController);
