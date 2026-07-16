import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "../src/config.js";
import { downloadFile } from "../src/knmi/client.js";
import { TUNER_FILENAME, TUNER_FRAME_PATH } from "../src/admin/tunerFrame.js";

// One-off fetch of the fixed color-tuner source frame, saved permanently to
// .data so the tuner never needs to hit KNMI's API again. Re-run this if
// .data is ever wiped. See apps/backend/src/admin/tunerFrame.ts.
const buffer = await downloadFile(TUNER_FILENAME);
await mkdir(config.paths.dataDir, { recursive: true });
await writeFile(TUNER_FRAME_PATH, buffer);
console.log(`Saved ${TUNER_FILENAME} to ${path.relative(process.cwd(), TUNER_FRAME_PATH)}`);
