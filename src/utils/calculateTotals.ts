export function calculateTotals(groups: any[]) {
  const assets = groups
    .filter((g) => g.name.includes("Assets"))
    .reduce((s, g) => s + g.subtotalCurrent, 0);

  const liabilities = groups
    .filter((g) => g.name.includes("Liabilities"))
    .reduce((s, g) => s + g.subtotalCurrent, 0);

  const equity = groups.find((g) => g.name === "Equity")?.subtotalCurrent || 0;

  return {
    assetsTotal: assets,
    liabilitiesPlusEquity: liabilities + equity,
    balanced: Math.abs(assets - (liabilities + equity)) < 0.01,
  };
}
