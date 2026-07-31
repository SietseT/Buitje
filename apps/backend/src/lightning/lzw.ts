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
  let code = 256;

  for (let i = 1; i < input.length; i++) {
    const currCode = input.charCodeAt(i);
    let phrase: string;
    if (currCode < 256) {
      phrase = input[i];
    } else {
      phrase = dict.get(currCode) ?? oldPhrase + currChar;
    }
    out.push(phrase);
    currChar = phrase.charAt(0);
    dict.set(code, oldPhrase + currChar);
    code++;
    oldPhrase = phrase;
  }

  return out.join("");
}
