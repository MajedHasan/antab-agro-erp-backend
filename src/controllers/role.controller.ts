// controllers/role.controller.ts
import { roleService } from "../services/role.service";
import { createCrudController } from "./crud.controller";

const base = createCrudController(roleService);

export const roleController = {
  ...base,
};
