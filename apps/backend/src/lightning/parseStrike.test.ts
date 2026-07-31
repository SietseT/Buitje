import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStrikeMessage } from "./parseStrike.js";
import { decodeLzw } from "./lzw.js";

// Mirrors lzw.test.ts's encoder - test-only, LZW-compresses a JSON payload
// the way a real Blitzortung message would arrive.
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

function encodeStrike(obj: unknown): string {
  return encodeLzw(JSON.stringify(obj));
}

test("parseStrikeMessage: parses a valid message", () => {
  const strike = parseStrikeMessage(
    encodeStrike({ time: 1700000000123456789, lat: 52.1, lon: 5.1, pol: -1 }),
  );
  assert.deepEqual(strike, {
    lat: 52.1,
    lon: 5.1,
    timeMs: Math.round(1700000000123456789 / 1e6),
    polarity: -1,
  });
});

test("parseStrikeMessage: returns null when lat is missing", () => {
  const strike = parseStrikeMessage(encodeStrike({ time: 1700000000123456789, lon: 5.1 }));
  assert.equal(strike, null);
});

test("parseStrikeMessage: returns null when lon is missing", () => {
  const strike = parseStrikeMessage(encodeStrike({ time: 1700000000123456789, lat: 52.1 }));
  assert.equal(strike, null);
});

test("parseStrikeMessage: returns null when time is missing", () => {
  const strike = parseStrikeMessage(encodeStrike({ lat: 52.1, lon: 5.1 }));
  assert.equal(strike, null);
});

test("parseStrikeMessage: polarity defaults to null when absent", () => {
  const strike = parseStrikeMessage(encodeStrike({ time: 1700000000123456789, lat: 52.1, lon: 5.1 }));
  assert.equal(strike?.polarity, null);
});

test("parseStrikeMessage: returns null for garbage input", () => {
  assert.equal(parseStrikeMessage("not lzw json at all"), null);
});
