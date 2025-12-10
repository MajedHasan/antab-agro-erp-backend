import { createCrudRouter } from "./crud.routes";
import { territoryController } from "../controllers/territory.controller";

const router = createCrudRouter(territoryController);
export default router;
