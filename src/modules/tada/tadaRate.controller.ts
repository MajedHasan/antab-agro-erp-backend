import { createCrudController } from "../../controllers/crud.controller";
import { tadaRateService } from "./tadaRate.service";

const base = createCrudController(tadaRateService, {
  defaultPopulate: [{ path: "createdBy", select: "name email" }],
});

export const tadaRateController = {
  ...base,
};

export type TadaRateController = typeof tadaRateController;
