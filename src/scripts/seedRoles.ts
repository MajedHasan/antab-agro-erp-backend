import Role from "../models/role.model";
import Permission from "../models/permission.model";

type RoleSeed = {
  name: string;
  department: string;
  permissions: string[];
  isSystem?: boolean;
};

const roles: RoleSeed[] = [
  // ============================================================
  // SYSTEM
  // ============================================================

  {
    name: "Super Admin",
    department: "System",
    permissions: [],
    isSystem: true,
  },

  // ============================================================
  // MANAGEMENT
  // ============================================================

  {
    name: "Chairman",
    department: "Management",
    permissions: [
      "dashboard.view",

      "salesdashboard.view",
      "salesreports.view",
      "sales&collections.view",

      "financialreports.view",
      "financialnotes.view",
      "financialposition.view",
      "profitloss.view",
      "changesequity.view",
      "accountsreports.view",
      "ledger.view",
      "trialbalance.view",

      "dealerledger.view",
      "inventoryreport.view",
    ],
  },

  {
    name: "Managing Director",
    department: "Management",
    permissions: [
      "dashboard.view",

      "salesdashboard.view",
      "sales.view",
      "salesreports.view",
      "sales&collections.view",
      "dealer.view",
      "dealerledger.view",
      "collections.view",

      "inventoryreport.view",
      "production.view",
      "wip.view",
      "materialwip.view",

      "financialreports.view",
      "financialnotes.view",
      "financialposition.view",
      "profitloss.view",
      "changesequity.view",
      "accountsreports.view",
      "ledger.view",
      "trialbalance.view",

      "supplier.view",
      "warehouse.view",
      "products.view",
      "finishedproducts.view",
    ],
  },

  {
    name: "CEO",
    department: "Management",
    permissions: [
      "dashboard.view",

      // Sales
      "salesdashboard.view",
      "sales.view",
      "salesreports.view",
      "sales&collections.view",
      "dealer.view",
      "dealerledger.view",
      "salesledger.view",
      "collections.view",

      // Inventory / Operations
      "inventoryreport.view",
      "products.view",
      "finishedproducts.view",
      "otherproducts.view",
      "warehouse.view",
      "production.view",
      "wip.view",
      "materialwip.view",
      "bom.view",
      "workorder.view",

      // Procurement
      "supplier.view",
      "goodreceipt.view",
      "rawmaterials.view",
      "packingmaterials.view",

      // Distribution
      "delivery.view",
      "warehousetransfer.view",
      "factorytransfer.view",

      // Marketing
      "productpromotion.view",
      "specialoffers.view",

      // Finance
      "financialreports.view",
      "financialnotes.view",
      "financialposition.view",
      "profitloss.view",
      "changesequity.view",
      "accountsreports.view",
      "ledger.view",
      "trialbalance.view",

      // HR / Company administration visibility
      "employees.view",
      "attendance.view",
      "payroll.view",
    ],
  },

  {
    name: "Head of Business",
    department: "Management",
    permissions: [
      "dashboard.view",

      "salesdashboard.view",
      "sales.view",
      "sales.create",
      "sales.edit",

      "dealer.view",
      "dealer.create",
      "dealer.edit",
      "dealerledger.view",

      "salesledger.view",
      "collections.view",
      "collections.create",
      "collections.edit",

      "salesreports.view",
      "sales&collections.view",

      "inventoryreport.view",
      "products.view",
      "finishedproducts.view",
      "otherproducts.view",

      "specialoffers.view",
      "productpromotion.view",

      "production.view",
      "wip.view",
      "materialwip.view",

      "financialreports.view",
      "profitloss.view",
    ],
  },

  // ============================================================
  // SALES MANAGEMENT
  // ============================================================

  {
    name: "NSM",
    department: "Sales",
    permissions: [
      "dashboard.view",
      "salesdashboard.view",

      "sales.view",
      "sales.create",
      "sales.edit",

      "dealer.view",
      "dealer.create",
      "dealer.edit",

      "dealerledger.view",
      "dealerledger.edit",

      "salesledger.view",

      "collections.view",
      "collections.create",
      "collections.edit",

      "delivery.view",
      "delivery.create",
      "delivery.edit",

      "salesreports.view",
      "sales&collections.view",

      "incentive.view",

      "zone.view",
      "region.view",
      "area.view",
      "territory.view",

      "products.view",
      "productpromotion.view",
      "specialoffers.view",

      "inventoryreport.view",
    ],
  },

  {
    name: "ZSM",
    department: "Sales",
    permissions: [
      "dashboard.view",
      "salesdashboard.view",

      "sales.view",
      "sales.create",
      "sales.edit",

      "dealer.view",
      "dealer.create",
      "dealer.edit",

      "dealerledger.view",

      "salesledger.view",

      "collections.view",
      "collections.create",
      "collections.edit",

      "delivery.view",
      "delivery.create",
      "delivery.edit",

      "salesreports.view",
      "sales&collections.view",

      "incentive.view",

      "zone.view",
      "region.view",
      "area.view",
      "territory.view",

      "products.view",
      "productpromotion.view",
      "specialoffers.view",
    ],
  },

  {
    name: "RSM",
    department: "Sales",
    permissions: [
      "dashboard.view",
      "salesdashboard.view",

      "sales.view",
      "sales.create",
      "sales.edit",

      "dealer.view",
      "dealer.create",
      "dealer.edit",

      "dealerledger.view",

      "salesledger.view",

      "collections.view",
      "collections.create",
      "collections.edit",

      "delivery.view",
      "delivery.create",
      "delivery.edit",

      "salesreports.view",
      "sales&collections.view",

      "incentive.view",

      "region.view",
      "area.view",
      "territory.view",

      "products.view",
      "productpromotion.view",
      "specialoffers.view",
    ],
  },

  {
    name: "Sr. ASM",
    department: "Sales",
    permissions: [
      "dashboard.view",
      "salesdashboard.view",

      "sales.view",
      "sales.create",
      "sales.edit",

      "dealer.view",
      "dealer.create",
      "dealer.edit",

      "dealerledger.view",

      "salesledger.view",

      "collections.view",
      "collections.create",
      "collections.edit",

      "delivery.view",
      "delivery.create",
      "delivery.edit",

      "salesreports.view",
      "sales&collections.view",

      "incentive.view",

      "area.view",
      "territory.view",

      "products.view",
      "specialoffers.view",
    ],
  },

  {
    name: "ASM",
    department: "Sales",
    permissions: [
      "dashboard.view",
      "salesdashboard.view",

      "sales.view",
      "sales.create",

      "dealer.view",
      "dealer.create",
      "dealer.edit",

      "dealerledger.view",

      "salesledger.view",

      "collections.view",
      "collections.create",

      "delivery.view",
      "delivery.create",

      "salesreports.view",

      "territory.view",

      "products.view",
      "specialoffers.view",
    ],
  },

  // ============================================================
  // PRODUCT / MARKETING
  // ============================================================

  {
    name: "Sr. Product Executive",
    department: "Marketing",
    permissions: [
      "dashboard.view",

      "products.view",
      "products.create",
      "products.edit",

      "productpromotion.view",
      "productpromotion.create",
      "productpromotion.edit",

      "specialoffers.view",
      "specialoffers.create",
      "specialoffers.edit",

      "salesdashboard.view",
      "sales.view",
      "salesreports.view",

      "inventoryreport.view",

      "prescription.view",
    ],
  },

  {
    name: "Sr. MO",
    department: "Marketing",
    permissions: [
      "dashboard.view",

      "products.view",
      "productpromotion.view",

      "specialoffers.view",
      "specialoffers.create",
      "specialoffers.edit",

      "salesdashboard.view",
      "sales.view",
      "salesreports.view",

      "dealer.view",
      "dealerledger.view",
    ],
  },

  {
    name: "Sr. Executive",
    department: "Marketing",
    permissions: [
      "dashboard.view",

      "products.view",
      "productpromotion.view",
      "specialoffers.view",

      "salesdashboard.view",
      "sales.view",
      "salesreports.view",

      "dealer.view",
      "dealerledger.view",
    ],
  },

  {
    name: "Sr. Marketing Officer",
    department: "Marketing",
    permissions: [
      "dashboard.view",

      "products.view",
      "productpromotion.view",

      "specialoffers.view",
      "specialoffers.create",

      "salesdashboard.view",
      "sales.view",

      "dealer.view",
    ],
  },

  {
    name: "Marketing Officer",
    department: "Marketing",
    permissions: [
      "dashboard.view",

      "products.view",
      "productpromotion.view",
      "specialoffers.view",

      "salesdashboard.view",
      "sales.view",

      "dealer.view",
    ],
  },

  {
    name: "Jr. Marketing Officer",
    department: "Marketing",
    permissions: [
      "dashboard.view",
      "products.view",
      "productpromotion.view",
      "specialoffers.view",
      "salesdashboard.view",
      "sales.view",
    ],
  },

  // ============================================================
  // SALES PROMOTION
  // ============================================================

  {
    name: "Sales Promotion Officer (SPO)",
    department: "Sales Promotion",
    permissions: [
      "dashboard.view",

      "salesdashboard.view",
      "sales.view",

      "products.view",
      "productpromotion.view",
      "productpromotion.create",
      "productpromotion.edit",

      "specialoffers.view",
      "specialoffers.create",

      "dealer.view",
      "dealerledger.view",

      "salesreports.view",
    ],
  },

  {
    name: "Jr. (SPO)",
    department: "Sales Promotion",
    permissions: [
      "dashboard.view",

      "salesdashboard.view",
      "sales.view",

      "products.view",
      "productpromotion.view",

      "specialoffers.view",

      "dealer.view",
    ],
  },

  // ============================================================
  // DISTRIBUTION
  // ============================================================

  {
    name: "Distribution Officer",
    department: "Distribution",
    permissions: [
      "dashboard.view",

      "delivery.view",
      "delivery.create",
      "delivery.edit",

      "warehouse.view",
      "warehousetransfer.view",
      "warehousetransfer.create",
      "warehousetransfer.edit",

      "dealer.view",
      "dealerledger.view",

      "sales.view",
      "salesledger.view",

      "inventoryreport.view",

      "damages.view",
      "damages.create",

      "return.view",
      "return.create",
    ],
  },

  {
    name: "Driver (Covered Van)",
    department: "Distribution",
    permissions: [
      "dashboard.view",
      "delivery.view",
    ],
  },

  {
    name: "Driver",
    department: "Distribution",
    permissions: [
      "dashboard.view",
      "delivery.view",
    ],
  },

  // ============================================================
  // SALES ADMINISTRATION
  // ============================================================

  {
    name: "Assistant Admin (Sales)",
    department: "Sales Administration",
    permissions: [
      "dashboard.view",

      "sales.view",
      "sales.create",
      "sales.edit",

      "dealer.view",
      "dealer.create",
      "dealer.edit",

      "salesledger.view",

      "collections.view",
      "collections.create",

      "delivery.view",
      "delivery.create",
      "delivery.edit",

      "salesreports.view",

      "products.view",
      "specialoffers.view",
    ],
  },

  // ============================================================
  // IT
  // ============================================================

  {
    name: "Developer",
    department: "IT",
    permissions: [
      "dashboard.view",

      "users.view",
      "userslocation.view",
      "userswarehouse.view",

      "roles.view",
      "permissions.view",
      "departments.view",

      "media.view",
      "media.create",
      "media.edit",
      "media.delete",
    ],
  },

  // ============================================================
  // ACCOUNTS
  // ============================================================

  {
    name: "CFO",
    department: "Accounts",
    permissions: [
      "dashboard.view",

      "chartofaccounts.view",
      "chartofaccounts.create",
      "chartofaccounts.edit",
      "chartofaccounts.delete",

      "collections.view",
      "collections.create",
      "collections.edit",
      "collections.delete",

      "vouchers.view",
      "vouchers.create",
      "vouchers.edit",
      "vouchers.delete",

      "voucheradmin.view",
      "voucheradmin.create",
      "voucheradmin.edit",
      "voucheradmin.delete",

      "receivevoucher.view",
      "receivevoucher.create",
      "receivevoucher.edit",
      "receivevoucher.delete",

      "bankreceive.view",
      "bankreceive.create",
      "bankreceive.edit",
      "bankreceive.delete",

      "cashreceive.view",
      "cashreceive.create",
      "cashreceive.edit",
      "cashreceive.delete",

      "paymentvoucher.view",
      "paymentvoucher.create",
      "paymentvoucher.edit",
      "paymentvoucher.delete",

      "bankpayment.view",
      "bankpayment.create",
      "bankpayment.edit",
      "bankpayment.delete",

      "cashpayment.view",
      "cashpayment.create",
      "cashpayment.edit",
      "cashpayment.delete",

      "journalvoucher.view",
      "journalvoucher.create",
      "journalvoucher.edit",
      "journalvoucher.delete",

      "contravoucher.view",
      "contravoucher.create",
      "contravoucher.edit",
      "contravoucher.delete",

      "accountsreports.view",
      "financialreports.view",
      "financialnotes.view",
      "financialposition.view",
      "profitloss.view",
      "changesequity.view",
      "ledger.view",
      "trialbalance.view",
      "otherreports.view",

      "dealerledger.view",
      "dealerledger.edit",
    ],
  },

  {
    name: "Executive Accounts",
    department: "Accounts",
    permissions: [
      "dashboard.view",

      "chartofaccounts.view",

      "collections.view",
      "collections.create",
      "collections.edit",

      "vouchers.view",
      "vouchers.create",
      "vouchers.edit",

      "receivevoucher.view",
      "receivevoucher.create",
      "receivevoucher.edit",

      "bankreceive.view",
      "bankreceive.create",
      "bankreceive.edit",

      "cashreceive.view",
      "cashreceive.create",
      "cashreceive.edit",

      "paymentvoucher.view",
      "paymentvoucher.create",
      "paymentvoucher.edit",

      "bankpayment.view",
      "bankpayment.create",
      "bankpayment.edit",

      "cashpayment.view",
      "cashpayment.create",
      "cashpayment.edit",

      "journalvoucher.view",
      "journalvoucher.create",
      "journalvoucher.edit",

      "contravoucher.view",
      "contravoucher.create",
      "contravoucher.edit",

      "ledger.view",
      "trialbalance.view",

      "accountsreports.view",
      "financialreports.view",
    ],
  },

  {
    name: "Accounts",
    department: "Accounts",
    permissions: [
      "dashboard.view",

      "chartofaccounts.view",

      "collections.view",
      "collections.create",

      "vouchers.view",
      "vouchers.create",

      "receivevoucher.view",
      "receivevoucher.create",

      "bankreceive.view",
      "bankreceive.create",

      "cashreceive.view",
      "cashreceive.create",

      "paymentvoucher.view",
      "paymentvoucher.create",

      "bankpayment.view",
      "bankpayment.create",

      "cashpayment.view",
      "cashpayment.create",

      "journalvoucher.view",
      "journalvoucher.create",

      "contravoucher.view",
      "contravoucher.create",

      "ledger.view",
      "trialbalance.view",
    ],
  },

  {
    name: "Jr. Accounts",
    department: "Accounts",
    permissions: [
      "dashboard.view",

      "collections.view",
      "collections.create",

      "vouchers.view",
      "vouchers.create",

      "receivevoucher.view",
      "receivevoucher.create",

      "cashreceive.view",
      "cashreceive.create",

      "paymentvoucher.view",
      "paymentvoucher.create",

      "cashpayment.view",
      "cashpayment.create",
    ],
  },

  // ============================================================
  // ADMINISTRATION
  // ============================================================

  {
    name: "Night Guard",
    department: "Administration",
    permissions: [
      "dashboard.view",
    ],
  },
];

export default async function seedRoles() {
  const permissions = await Permission.find({}).lean();

  const permissionMap = new Map(
    permissions.map((permission) => [
      permission.name,
      permission._id,
    ])
  );

  let created = 0;
  let updated = 0;

  for (const role of roles) {
    const permissionIds = [];

    for (const permissionName of role.permissions) {
      const permissionId = permissionMap.get(permissionName);

      if (!permissionId) {
        console.warn(
          `[RBAC] Permission "${permissionName}" not found for role "${role.name}"`
        );
        continue;
      }

      permissionIds.push(permissionId);
    }

    const existing = await Role.findOne({
      name: role.name,
    });

    if (existing) {
      existing.department = role.department;
      existing.permissions = permissionIds;
      existing.isSystem = role.isSystem ?? false;

      await existing.save();

      updated++;
    } else {
      await Role.create({
        name: role.name,
        department: role.department,
        permissions: permissionIds,
        isSystem: role.isSystem ?? false,
      });

      created++;
    }
  }

  console.log(
    `[RBAC] Roles synchronized. Created: ${created}, Updated: ${updated}, Total: ${roles.length}`
  );
}