import { createCrudRouter } from "./crud.routes";
import { areaController } from "../controllers/area.controller";

const router = createCrudRouter(areaController);
export default router;
