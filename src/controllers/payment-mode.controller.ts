import { createCrudController } from "./crud.controller";
import { paymentModeService } from "../services/payment-mode.service";

export const paymentModeController = createCrudController(paymentModeService);
