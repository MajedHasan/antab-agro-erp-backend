import { createCrudRouter } from "./crud.routes";
import { regionController } from "../controllers/region.controller";

const router = createCrudRouter(regionController);
export default router;
