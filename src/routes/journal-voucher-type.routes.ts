import { createCrudRouter } from "./crud.routes";
import { journalVoucherTypeController } from "../controllers/journal-voucher-type.controller";

export default createCrudRouter(journalVoucherTypeController);
