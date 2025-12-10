import Role from "../models/role.model";
import Permission from "../models/permission.model";

const roles = [
  { name: "Super Admin", permissions: [], isSystem: true }, // no need for "*" string
  {
    name: "Accounts Manager",
    department: "Accounts",
    permissions: [
      "invoices.view",
      "invoices.create",
      "invoices.approve",
      "reports.view",
    ],
  },
  {
    name: "Marketing Manager",
    department: "Marketing",
    permissions: [
      "campaigns.view",
      "campaigns.create",
      "campaigns.edit",
      "reports.view",
    ],
  },
  {
    name: "Marketing Executive",
    department: "Marketing",
    permissions: ["campaigns.view", "campaigns.create"],
  },
  {
    name: "Sales Head",
    department: "Sales",
    permissions: ["deals.view", "reports.view"],
  },
];

export default async function seed() {
  // fetch all permissions in DB
  const allPerms = await Permission.find({}).lean();
  const permMap: Record<string, string> = {};
  allPerms.forEach((p) => (permMap[p.name] = p._id.toString()));

  for (const r of roles) {
    const exists = await Role.findOne({ name: r.name });
    if (exists) continue;

    const permIds = r.permissions.map((p) => permMap[p]).filter(Boolean); // convert names -> ObjectIds
    await Role.create({ ...r, permissions: permIds });
  }
  console.log("roles seeded");
}
