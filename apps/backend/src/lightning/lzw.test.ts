import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeLzw } from "./lzw.js";

// Standard string-LZW encoder (the counterpart to decodeLzw), used here only
// to build test fixtures. NOTE: this round-trips against our own encoder,
// not a message captured from a real Blitzortung connection - this sandbox
// couldn't reach wss://ws*.blitzortung.org:3000/ to capture one (see the
// implementation plan's flagged open item). Re-verify decodeLzw against a
// real captured message once connectivity is confirmed from the deployment
// host.
function encodeLzw(input: string): string {
  const dict = new Map<string, number>();
  let phrase = input[0] ?? "";
  const out: number[] = [];
  let code = 256;

  for (let i = 1; i < input.length; i++) {
    const currChar = input[i];
    const combined = phrase + currChar;
    if (dict.has(combined)) {
      phrase = combined;
    } else {
      out.push(phrase.length > 1 ? (dict.get(phrase) as number) : phrase.charCodeAt(0));
      dict.set(combined, code);
      code++;
      phrase = currChar;
    }
  }
  out.push(phrase.length > 1 ? (dict.get(phrase) as number) : phrase.charCodeAt(0));
  return out.map((c) => String.fromCharCode(c)).join("");
}

test("decodeLzw: round-trips plain text", () => {
  const input = "hello world hello world hello world";
  assert.equal(decodeLzw(encodeLzw(input)), input);
});

test("decodeLzw: round-trips JSON-shaped strike data", () => {
  const input = JSON.stringify({
    time: 1700000000123456789,
    lat: 52.1,
    lon: 5.1,
    alt: 0,
    pol: 1,
    mds: 5000,
    mcg: 12,
    status: 0,
    region: 1,
    sig: [{ sta: 1 }, { sta: 2 }],
  });
  assert.equal(decodeLzw(encodeLzw(input)), input);
});

test("decodeLzw: handles a single character", () => {
  assert.equal(decodeLzw(encodeLzw("x")), "x");
});

test("decodeLzw: handles an empty string", () => {
  assert.equal(decodeLzw(""), "");
});
