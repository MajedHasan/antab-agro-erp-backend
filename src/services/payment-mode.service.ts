import { createCrudService } from "./crud.service";
import { PaymentMode } from "../models/payment-mode.model";

export const paymentModeService = createCrudService(PaymentMode, {
  defaultSort: "name",
  searchFields: ["name"],
  allowedFilterFields: ["isActive", "voucherTypes"],
});
