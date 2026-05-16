/**
 * Bundles src/browser.ts → dist/assistrio-chat.js (IIFE).
 * Run from package root: npm run build:js
 */

import * as esbuild from "esbuild";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "dist");
const outfile = join(outDir, "assistrio-chat.js");

const isDebug = process.env.EMBED_DEBUG === "1";

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src", "browser.ts")],
  bundle: true,
  outfile,
  format: "iife",
  globalName: "AssistrioChat",
  platform: "browser",
  target: ["es2018"],
  minify: !isDebug,
  sourcemap: isDebug,
  jsx: "automatic",
  logLevel: "info",
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": JSON.stringify(isDebug ? "development" : "production"),
  },
});

console.log(`Built ${outfile}`);