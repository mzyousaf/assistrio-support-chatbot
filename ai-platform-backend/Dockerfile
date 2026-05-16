# -----------------------------------------------------------------------------
# Stage 1 — dependencies + compile
# Installs all dependencies (including devTools needed for `nest build`), copies
# only sources and config required for TypeScript compilation, then emits `dist/`.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Lockfile-driven install: reproducible, fails if package-lock.json is out of sync.
COPY package.json package-lock.json ./

RUN npm ci

# Minimal project files needed for `nest build` (matches nest-cli + tsconfig).
COPY nest-cli.json tsconfig.json ./
COPY src ./src

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — production runtime
# Fresh production-only `node_modules`, application bytecode, and no compiler CLI.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# word-extractor uses the `antiword` binary on Linux for legacy `.doc` text extraction.
# Without it, `.doc` ingestion paths can fail at runtime; other formats are unaffected.
RUN apk add --no-cache antiword

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Run as unprivileged user from the official Node image.
RUN chown -R node:node /app
USER node

EXPOSE 3001

# Matches package.json "start": "node dist/main"
CMD ["node", "dist/main"]
