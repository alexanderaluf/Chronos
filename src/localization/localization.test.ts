/// <reference types="node" />
/**
 * Translation integrity: Hebrew and Russian must have exactly the English keys
 * (TypeScript already checks shape) and the same {{placeholders}} in every
 * string, so interpolation never shows a raw "{{name}}" in one language.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { en } from "./locales/en";
import { he } from "./locales/he";
import { ru } from "./locales/ru";

type Tree = { [key: string]: string | string[] | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else if (Array.isArray(value)) value.forEach((item, index) => result.set(`${path}.${index}`, item));
    else for (const [nested, text] of flatten(value, path)) result.set(nested, text);
  }
  return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

const english = flatten(en as unknown as Tree);

for (const [name, locale] of [
  ["Hebrew", he],
  ["Russian", ru],
] as const) {
  describe(`${name} translation`, () => {
    const translated = flatten(locale as unknown as Tree);

    it("has exactly the English keys", () => {
      assert.deepEqual([...translated.keys()].sort(), [...english.keys()].sort());
    });

    it("keeps every {{placeholder}}", () => {
      for (const [key, text] of english) {
        assert.deepEqual(placeholders(translated.get(key) ?? ""), placeholders(text), `${name}: ${key}`);
      }
    });

    it("has no empty strings", () => {
      for (const [key, text] of translated) assert.ok(text.trim().length > 0, `${name}: ${key} is empty`);
    });

    it("has no encoding replacement characters or runs of question marks", () => {
      for (const [key, text] of translated) {
        assert.ok(!/\uFFFD|\?{2,}/u.test(text), `${name}: ${key} contains corrupted text`);
      }
    });
  });
}
