import { createCrudRouter } from "./crud.routes";
import { paymentModeController } from "../controllers/payment-mode.controller";

export default createCrudRouter(paymentModeController);
