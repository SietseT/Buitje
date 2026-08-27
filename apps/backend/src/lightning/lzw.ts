// A legitimate decoded Blitzortung strike is a few hundred bytes of JSON.
// LZW's dictionary growth means a crafted or corrupt input can expand to a
// much larger output than its input length would suggest (each new
// dictionary entry can chain onto the previous one, so output length can
// grow faster than linearly in the number of input codes) - this caps that
// growth so a malicious/broken relay can't force an unbounded allocation.
const MAX_DECODED_LENGTH = 1_048_576; // 1 MiB

/**
 * Blitzortung's WebSocket messages are LZW-compressed JSON strings. This is
 * the standard string-LZW decoder used by Blitzortung's own frontend and
 * essentially every third-party client (blitzortung.js, the Home Assistant
 * integration, SimonSchick/BlitzortungAPI) - dictionary seeded with single
 * characters, growing from code 256 up as the stream is decoded.
 */
export function decodeLzw(input: string): string {
  if (input.length === 0) return "";

  const dict = new Map<number, string>();
  let currChar = input[0];
  let oldPhrase = currChar;
  const out: string[] = [currChar];
  let outLength = currChar.length;
  let code = 256;

  for (let i = 1; i < input.length; i++) {
    const currCode = input.charCodeAt(i);
    let phrase: string;
    if (currCode < 256) {
      phrase = input[i];
    } else {
      phrase = dict.get(currCode) ?? oldPhrase + currChar;
    }
    outLength += phrase.length;
    if (outLength > MAX_DECODED_LENGTH) {
      throw new Error("decodeLzw: output exceeded size limit");
    }
    out.push(phrase);
    currChar = phrase.charAt(0);
    dict.set(code, oldPhrase + currChar);
    code++;
    oldPhrase = phrase;
  }

  return out.join("");
}
