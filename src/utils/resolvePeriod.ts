export function resolvePeriod(type: "monthly" | "yearly", value: string) {
  if (type === "monthly") {
    const [y, m] = value.split("-").map(Number);
    return {
      from: new Date(y, m - 1, 1),
      to: new Date(y, m, 0, 23, 59, 59),
    };
  }

  const year = Number(value);
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
  };
}
