import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SWITCH_INSET, SWITCH_THUMB_SIZE, SWITCH_TRACK_HEIGHT, SWITCH_TRACK_WIDTH, switchThumbOffset } from "./app-switch-layout";

describe("switch RTL and LTR travel", () => {
  const left = (progress: number, rtl: boolean) => SWITCH_INSET + switchThumbOffset(progress, rtl);

  it("activates towards the right in LTR and towards the left in RTL", () => {
    assert.equal(left(0, false), SWITCH_INSET);
    assert.equal(left(1, false) + SWITCH_THUMB_SIZE, SWITCH_TRACK_WIDTH - SWITCH_INSET);
    assert.equal(left(0, true) + SWITCH_THUMB_SIZE, SWITCH_TRACK_WIDTH - SWITCH_INSET);
    assert.equal(left(1, true), SWITCH_INSET);
  });

  it("keeps the full thumb within the track throughout both animations", () => {
    for (const rtl of [false, true]) {
      for (let step = -100; step <= 1100; step++) {
        const x = left(step / 1000, rtl);
        assert.ok(x >= SWITCH_INSET);
        assert.ok(x + SWITCH_THUMB_SIZE <= SWITCH_TRACK_WIDTH - SWITCH_INSET);
      }
    }
    assert.ok(SWITCH_INSET + SWITCH_THUMB_SIZE <= SWITCH_TRACK_HEIGHT - SWITCH_INSET);
  });

  it("mirrors a partially completed toggle without changing state or leaving the track", () => {
    for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const ltrCenter = left(progress, false) + SWITCH_THUMB_SIZE / 2;
      const rtlCenter = left(progress, true) + SWITCH_THUMB_SIZE / 2;
      assert.equal(ltrCenter + rtlCenter, SWITCH_TRACK_WIDTH);
    }
  });
});
