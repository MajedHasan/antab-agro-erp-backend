import Permission from "../models/permission.model";

type PermissionDefinition = {
  name: string;
  description: string;
};

const CRUD_RESOURCES: Record<string, string> = {
  dashboard: "Dashboard",

  supplier: "Suppliers",
  workorder: "Work Orders",
  goodreceipt: "Goods Receipts",
  rawmaterials: "Raw Materials",
  packingmaterials: "Packaging Materials",
  finishedproducts: "Finished Products",
  otherproducts: "Other Products",
  inventoryreport: "Inventory Reports",
  factorytransfer: "Factory Transfers",

  bom: "Bill of Materials",
  production: "Production",
  wip: "WIP",
  materialwip: "Material WIP",

  salesdashboard: "Sales Dashboard",
  sales: "Sales",
  delivery: "Delivery",
  tada: "TADA",
  prescription: "Prescriptions",

  warehousetransfer: "Warehouse Transfers",
  salesledger: "Sales Ledger",
  dealer: "Dealers",
  zone: "Zones",
  region: "Regions",
  area: "Areas",
  territory: "Territories",
  warehouse: "Warehouses",

  products: "Products",
  productpromotion: "Product Promotions",
  specialoffers: "Special Offers",
  damages: "Damages",
  return: "Returns",
  incentive: "Incentives",
  salesreports: "Sales Reports",
  "sales&collections": "Sales & Collections",

  chartofaccounts: "Chart of Accounts",
  collections: "Collections",
  vouchers: "Vouchers",
  voucheradmin: "Voucher Administration",
  receivevoucher: "Receive Vouchers",
  bankreceive: "Bank Receipts",
  cashreceive: "Cash Receipts",
  paymentvoucher: "Payment Vouchers",
  bankpayment: "Bank Payments",
  cashpayment: "Cash Payments",
  journalvoucher: "Journal Vouchers",
  contravoucher: "Contra Vouchers",

  accountsreports: "Accounts Reports",
  financialreports: "Financial Reports",
  financialnotes: "Financial Notes",
  financialposition: "Statement of Financial Position",
  profitloss: "Profit & Loss",
  changesequity: "Changes in Equity",
  ledger: "Ledger",
  trialbalance: "Trial Balance",
  otherreports: "Other Reports",

  hrpayroll: "HR & Payroll",
  employees: "Employees",
  payroll: "Payroll",
  attendance: "Attendance",

  admin: "Administration",
  users: "Users",
  userslocation: "User Location Access",
  userswarehouse: "User Warehouse Access",
  roles: "Roles",
  departments: "Departments",
  permissions: "Permissions",
  media: "Media",
};

const ACTIONS = ["view", "create", "edit", "delete"] as const;

const permissions: PermissionDefinition[] = [];

for (const [resource, label] of Object.entries(CRUD_RESOURCES)) {
  for (const action of ACTIONS) {
    permissions.push({
      name: `${resource}.${action}`,
      description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${label}`,
    });
  }
}

// Special permissions that exist in your sidebar but are not full CRUD.
permissions.push(
  {
    name: "supplier.approve",
    description: "Approve suppliers",
  },
  {
    name: "supplier.reject",
    description: "Reject suppliers",
  },
  {
    name: "dealerledger.edit",
    description: "Edit dealer ledger",
  }
);

export default async function seedPermissions() {
  let created = 0;
  let updated = 0;

  for (const permission of permissions) {
    const existing = await Permission.findOne({
      name: permission.name,
    });

    if (existing) {
      if (existing.description !== permission.description) {
        existing.description = permission.description;
        await existing.save();
        updated++;
      }

      continue;
    }

    await Permission.create(permission);
    created++;
  }

  console.log(
    `Permissions synchronized. Created: ${created}, Updated: ${updated}, Total: ${permissions.length}`
  );
}