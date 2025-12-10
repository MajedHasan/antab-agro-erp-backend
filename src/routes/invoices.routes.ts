// routes/invoices.ts
import express from "express";
import { authorize } from "../middlewares/authorize.middleware";
const router = express.Router();

router.post("/create", authorize(["invoices.create"]), () => {
  /*
   in here will need to replace with real controller
   createInvoice 
   */
});
router.post(
  "/approve",
  authorize(["invoices.approve"], {
    requireAny: false,
    allowedDepartments: ["Accounts"],
  }),
  () => {
    /*  
        in here will need to replace with real controller
        approveInvoice
    */
  }
);

// allow owners to update their own invoices OR users with `invoices.edit_all`
// router.put(
//   "/:id",
//   authorize(["invoices.edit_all"], {
//     allowOwner: async (req, userId) => {
//       const invoice = await Invoice.findById(req.params.id).lean();
//       return invoice && String(invoice.createdBy) === userId;
//     },
//   }),
//   updateInvoice
// );
