#!/usr/bin/env node
import path from "node:path";
import { generateTypes } from "./index.js";

const args = process.argv.slice(2);
const manifestIndex = args.indexOf("--manifest");
const outDirIndex = args.indexOf("--outDir");
const fileNameIndex = args.indexOf("--fileName");

if (manifestIndex === -1 || outDirIndex === -1) {
  console.error("Usage: accord-types --manifest <path> --outDir <path> [--fileName name]");
  process.exit(1);
}

const manifestPath = path.resolve(process.cwd(), args[manifestIndex + 1]);
const outDir = path.resolve(process.cwd(), args[outDirIndex + 1]);
const fileName = fileNameIndex === -1 ? undefined : args[fileNameIndex + 1];

generateTypes({ manifestPath, outDir, fileName }).catch((error) => {
  console.error(error);
  process.exit(1);
});
