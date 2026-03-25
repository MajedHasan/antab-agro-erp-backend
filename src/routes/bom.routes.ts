import { createCrudRouter } from "./crud.routes";
import { bomController } from "../controllers/bom.controller";

export default createCrudRouter(bomController);
