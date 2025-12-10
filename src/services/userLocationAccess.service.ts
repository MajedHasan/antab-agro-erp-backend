// src/services/userLocationAccess.service.ts
import UserLocationAccessModel from "../models/userLocationAccess.model";
import { createCrudService } from "./crud.service";

export const userLocationAccessService = createCrudService(
  UserLocationAccessModel,
  {
    searchFields: ["user"], // optional
    allowedFilterFields: ["user", "access.zone"],
    defaultPopulate: [
      { path: "user" },
      { path: "assignedBy" },
      { path: "createdBy" },
      { path: "access.zone" },
      { path: "access.regions.region" },
      { path: "access.regions.areas.area" },
      { path: "access.regions.areas.territories" },
    ],
  }
);
