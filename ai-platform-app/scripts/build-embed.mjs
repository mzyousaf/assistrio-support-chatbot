/**
 * Produces dist/embed/assistrio-chat.js (IIFE) for third-party script tags.
 * Resolves @/ to ./src/ (same as tsconfig paths).
 */

import * as esbuild from "esbuild";
import { existsSync, mkdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "dist", "embed");
const outfile = join(outDir, "assistrio-chat.js");

function resolveAliasPath(importPath) {
  const rel = importPath.slice(2);
  const base = join(root, "src", rel);
  const candidates = [];
  if (existsSync(base) && statSync(base).isDirectory()) {
    candidates.push(
      join(base, "index.tsx"),
      join(base, "index.ts"),
      join(base, "index.jsx"),
      join(base, "index.js")
    );
  }
  candidates.push(
    base + ".tsx",
    base + ".ts",
    base + ".jsx",
    base + ".js"
  );
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return base + ".tsx";
}

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src", "embed", "browser.ts")],
  bundle: true,
  outfile,
  format: "iife",
  platform: "browser",
  target: ["es2018"],
  minify: process.env.EMBED_DEBUG === "1" ? false : true,
  sourcemap: process.env.EMBED_DEBUG === "1",
  jsx: "automatic",
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [
    {
      name: "alias-at",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: resolveAliasPath(args.path),
        }));
      },
    },
  ],
});

console.log(`Built ${outfile}`);
