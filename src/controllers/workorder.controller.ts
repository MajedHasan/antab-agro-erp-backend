import { createCrudController } from "./crud.controller";
import { workOrderService } from "../services/workorder.service";

export const workOrderController = {
  ...createCrudController(workOrderService),
};
