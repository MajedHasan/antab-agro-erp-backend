// controllers/permission.controller.ts

import { createCrudController } from "./crud.controller";
import { permissionService } from "../services/permission.service";

const base = createCrudController(permissionService);

export const permissionController = {
  ...base,
};
