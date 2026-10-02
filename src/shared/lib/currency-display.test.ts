import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCurrencyStatement } from "./currency-display";

describe("currency statement direction", () => {
  for (const locale of ["en-IL", "he-IL", "ru-IL"]) {
    it(`keeps the sign first and symbol last in ${locale}`, () => {
      const decimal = locale.startsWith("ru") ? "," : ".";
      assert.equal(formatCurrencyStatement(-1830, "USD", locale), `\u2066-18${decimal}30$\u2069`);
      assert.equal(formatCurrencyStatement(1830, "ILS", locale), `\u206618${decimal}30₪\u2069`);
      assert.equal(formatCurrencyStatement(0, "EUR", locale), `\u20660${decimal}00€\u2069`);
    });
  }

  it("retains the grouping and decimal separators of the app locale", () => {
    assert.equal(formatCurrencyStatement(-123456, "USD", "he-IL"), "\u2066-1,234.56$\u2069");
    assert.equal(formatCurrencyStatement(123456, "USD", "ru-IL"), "\u20661\u00a0234,56$\u2069");
  });

  it("displays unknown currency codes without losing the amount", () => {
    assert.equal(formatCurrencyStatement(-1830, "INVALID", "en-IL"), "\u2066-18.30INVALID\u2069");
  });
});
