import { createCrudRouter } from "./crud.routes";
import { packagingController } from "../controllers/packaging.controller";

export default createCrudRouter(packagingController);
