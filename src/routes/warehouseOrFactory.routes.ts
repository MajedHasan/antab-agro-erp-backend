import { createCrudRouter } from "./crud.routes";
import { warehouseOrFactoryController } from "../controllers/warehouseOrFactory.controller";

const router = createCrudRouter(warehouseOrFactoryController);

// ➕ Custom extended routes (same style as user.routes.ts)
router.post("/:id/assign-users", warehouseOrFactoryController.assignUsers);
router.delete(
  "/:id/remove-user/:userId",
  warehouseOrFactoryController.removeUser,
);
router.get("/:id/users", warehouseOrFactoryController.listUsers);
router.get("/:id/location", warehouseOrFactoryController.getWithAddress);

export default router;
