import { createCrudController } from "./crud.controller";
import { supplierService } from "../services/supplier.service";

export const supplierController = createCrudController(supplierService, {
  defaultPopulate: [
    { path: "tinFile" },
    { path: "binFile" },
    { path: "nidFile" },
    { path: "tradeLicenseFile" },
  ],
});
