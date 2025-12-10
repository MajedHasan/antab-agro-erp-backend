import { createCrudRouter } from "./crud.routes";
import { warehouseController } from "../controllers/warehouse.controller";

const router = createCrudRouter(warehouseController);

// ➕ Custom extended routes (same style as user.routes.ts)
router.post("/:id/assign-users", warehouseController.assignUsers);
router.delete("/:id/remove-user/:userId", warehouseController.removeUser);
router.get("/:id/users", warehouseController.listUsers);

export default router;
