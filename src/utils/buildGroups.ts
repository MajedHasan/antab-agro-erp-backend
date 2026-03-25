export function buildGroups(current: any[], prior: any[] | null) {
  const groupMap: Record<string, any[]> = {
    "Current Assets": [],
    "Non-Current Assets": [],
    "Current Liabilities": [],
    "Non-Current Liabilities": [],
    Equity: [],
  };

  for (const acc of current) {
    const group =
      acc.type === "asset"
        ? acc.subType === "current"
          ? "Current Assets"
          : "Non-Current Assets"
        : acc.type === "liability"
          ? acc.subType === "current"
            ? "Current Liabilities"
            : "Non-Current Liabilities"
          : "Equity";

    groupMap[group].push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      group,
      currentBalance: acc.balance,
      priorBalance: prior
        ? prior.find((p) => p.id.equals(acc.id))?.balance || 0
        : undefined,
      noteRef: acc.noteRef,
    });
  }

  return Object.entries(groupMap).map(([name, accounts]) => ({
    name,
    accounts,
    subtotalCurrent: accounts.reduce((s, a) => s + a.currentBalance, 0),
    subtotalPrior: prior
      ? accounts.reduce((s, a) => s + (a.priorBalance || 0), 0)
      : undefined,
  }));
}
