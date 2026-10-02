import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { localizedDayLabel, localizedMonthLabel } from "./dates";
import { i18n } from "./i18n";

describe("translated month labels", () => {
  const october = new Date(2026, 9, 1);
  const november = new Date(2026, 10, 1);

  it("uses Hebrew names for the selector and abbreviated chart labels", () => {
    assert.equal(localizedMonthLabel(october, "he"), "אוקטובר 2026");
    assert.equal(localizedMonthLabel(october, "he", true), "אוק׳");
    assert.equal(localizedMonthLabel(november, "he", true), "נוב׳");
    assert.match(localizedDayLabel(october, "he"), /אוק׳/);
  });

  it("uses English and Russian names", () => {
    assert.equal(localizedMonthLabel(october, "en"), "October 2026");
    assert.equal(localizedMonthLabel(november, "en", true), "Nov");
    assert.equal(localizedMonthLabel(october, "ru"), "октябрь 2026");
    assert.equal(localizedMonthLabel(november, "ru", true), "ноя");
  });

  it("follows the explicit app language even when the global language differs", async () => {
    await i18n.changeLanguage("en");
    assert.equal(localizedMonthLabel(october, "he"), "אוקטובר 2026");
    await i18n.changeLanguage("he");
    assert.equal(localizedMonthLabel(october, "en"), "October 2026");
    await i18n.changeLanguage("en");
  });
});
