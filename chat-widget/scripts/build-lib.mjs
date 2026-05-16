/**
 * ESM library entry for npm: import { EmbedWidgetRoot } from "@assistrio/chat-widget"
 * (dist/index.mjs). Browser CDN bundle remains dist/assistrio-chat.js (IIFE).
 */

import * as esbuild from "esbuild";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "dist");
const outfile = join(outDir, "index.mjs");

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src", "index.ts")],
  bundle: true,
  outfile,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  sourcemap: true,
  jsx: "automatic",
  logLevel: "info",
  legalComments: "none",
  external: ["react", "react-dom", "react/jsx-runtime"],
});

console.log(`Built ${outfile}`);

const quickIconsOut = join(outDir, "quick-link-icons.mjs");
await esbuild.build({
  entryPoints: [join(root, "src", "quick-link-icons.ts")],
  bundle: true,
  outfile: quickIconsOut,
  format: "esm",
  platform: "neutral",
  target: ["es2020"],
  minify: true,
  sourcemap: true,
  jsx: "automatic",
  logLevel: "info",
  legalComments: "none",
  external: ["react", "react-dom", "react/jsx-runtime", "lucide-react"],
});

console.log(`Built ${quickIconsOut}`);
