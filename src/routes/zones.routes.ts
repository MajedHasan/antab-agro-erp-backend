import { createCrudRouter } from "./crud.routes";
import { zoneController } from "../controllers/zone.controller";

const router = createCrudRouter(zoneController);
export default router;
