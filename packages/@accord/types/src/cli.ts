#!/usr/bin/env node
import path from "node:path";
import { generateTypes } from "./index.js";

const args = process.argv.slice(2);
const manifestIndex = args.indexOf("--manifest");
const manifestUrlIndex = args.indexOf("--manifestUrl");
const outDirIndex = args.indexOf("--outDir");
const fileNameIndex = args.indexOf("--fileName");

if (
  outDirIndex === -1 ||
  (manifestIndex === -1 && manifestUrlIndex === -1) ||
  (manifestIndex !== -1 && manifestUrlIndex !== -1)
) {
  console.error(
    "Usage: accord-types --manifest <path> --outDir <path> [--fileName name]\n" +
      "   or: accord-types --manifestUrl <url> --outDir <path> [--fileName name]"
  );
  process.exit(1);
}

const manifestPath =
  manifestIndex === -1 ? undefined : path.resolve(process.cwd(), args[manifestIndex + 1]);
const manifestUrl = manifestUrlIndex === -1 ? undefined : args[manifestUrlIndex + 1];
const outDir = path.resolve(process.cwd(), args[outDirIndex + 1]);
const fileName = fileNameIndex === -1 ? undefined : args[fileNameIndex + 1];

generateTypes({ manifestPath, manifestUrl, outDir, fileName }).catch((error) => {
  console.error(error);
  process.exit(1);
});
