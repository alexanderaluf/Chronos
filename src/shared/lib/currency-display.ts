/** Currency statements always read sign → number → symbol, even inside Hebrew text. */
export function currencyStatementParts(amount: number, currency: string, locale: string) {
  let symbol = currency;
  try {
    symbol = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    // Preserve an unknown currency code rather than failing to display the amount.
  }
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Math.abs(amount) / 100);
  return { sign: amount < 0 ? "-" : "", number, symbol };
}

export function formatCurrencyStatement(amount: number, currency: string, locale: string): string {
  const { sign, number, symbol } = currencyStatementParts(amount, currency, locale);
  // Isolate the entire amount so an RTL paragraph cannot move the minus to the end.
  return `\u2066${sign}${number}${symbol}\u2069`;
}
