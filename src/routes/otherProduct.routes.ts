import { createCrudRouter } from "./crud.routes";
import { otherProductController } from "../controllers/otherProduct.controller";

export default createCrudRouter(otherProductController);
