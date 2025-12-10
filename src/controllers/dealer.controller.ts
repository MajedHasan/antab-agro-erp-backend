import { createCrudController } from "./crud.controller";
import { dealerService } from "../services/dealer.service";

export const dealerController = {
  ...createCrudController(dealerService),
};
