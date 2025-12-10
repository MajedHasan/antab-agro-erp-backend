// src/controllers/userLocationAccess.controller.ts
import { createCrudController } from "./crud.controller";
import { userLocationAccessService } from "../services/userLocationAccess.service";

export const userLocationAccessController = {
  ...createCrudController(userLocationAccessService, {
    defaultPopulate: [
      { path: "user" },
      { path: "assignedBy" },
      { path: "createdBy" },
      { path: "access.zone" },
      { path: "access.regions.region" },
      { path: "access.regions.areas.area" },
      { path: "access.regions.areas.territories" },
    ],
  }),
};
