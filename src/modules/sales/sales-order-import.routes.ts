import { Router } from "express";

import {
  salesOrderImportController,
} from "./sales-order-import.controller";

import salesOrderImportUpload from "./sales-order-import-upload.middleware";

const router =
  Router();

/*
|--------------------------------------------------------------------------
| Excel template
|--------------------------------------------------------------------------
|
| GET /sales-orders/import/template
|
| Downloads the official Excel template.
|
*/
router.get(
  "/template",
  salesOrderImportController.template,
);

/*
|--------------------------------------------------------------------------
| Preview
|--------------------------------------------------------------------------
|
| POST /sales-orders/import/preview
|
| multipart/form-data
| field name: file
|
| IMPORTANT:
| This only reads/validates/calculates the Excel.
| It does NOT create SalesOrders.
|
*/
router.post(
  "/preview",
  salesOrderImportUpload,
  salesOrderImportController.preview,
);

/*
|--------------------------------------------------------------------------
| Confirm
|--------------------------------------------------------------------------
|
| POST /sales-orders/import/confirm
|
| This will be connected to the real SalesOrder creation
| transaction in the next step.
|
*/
router.post(
  "/confirm",
  salesOrderImportUpload,
  salesOrderImportController.confirm,
);

export default router;