// routes/roles.routes.ts
import { createCrudRouter } from "./crud.routes";
import { roleController } from "../controllers/role.controller";

const router = createCrudRouter(roleController);

export default router;
