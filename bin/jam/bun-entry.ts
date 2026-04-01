// biome-ignore-all lint/suspicious/noConsole: bin file

// reflect-metadata polyfill required by tsyringe (transitive dep of @matrixai/quic)
// eslint-disable-next-line import/no-extraneous-dependencies
import "reflect-metadata";

import { existsSync } from "node:fs";
import Module from "node:module";
import { dirname, join } from "node:path";

const binDir = dirname(process.execPath);

// Native addon resolution for the compiled bun binary.
//
// lmdb: uses node-gyp-build which checks prebuilds/<platform>/ next to execPath.
//   → Handled by placing prebuilds/darwin-arm64/node.napi.node in the dist folder.
//
// quic + bandersnatch: resolve platform packages via require() (e.g. '@matrixai/quic-darwin-arm64')
//   → Intercepted by Module._resolveFilename and process.dlopen patches below.

const NATIVE_SIBLING_FILES: [pattern: RegExp, file: string][] = [
  [/quic/, "quic.node"],
  [/bandersnatch/, "bandersnatch.node"],
];

function findSibling(identifier: string): string | null {
  for (const [pattern, fileName] of NATIVE_SIBLING_FILES) {
    if (pattern.test(identifier)) {
      const siblingPath = join(binDir, fileName);
      if (existsSync(siblingPath)) {
        return siblingPath;
      }
    }
  }
  return null;
}

// Patch Module._resolveFilename so that require('@matrixai/quic-darwin-arm64') etc.
// resolve to our sibling .node files instead of failing inside /$bunfs/root/.
// biome-ignore lint/suspicious/noExplicitAny: _resolveFilename is a Node internal not in the type defs
const originalResolve = (Module as any)._resolveFilename;
if (typeof originalResolve === "function") {
  // biome-ignore lint/suspicious/noExplicitAny: patching Node internal
  (Module as any)._resolveFilename = function patchedResolve(request: string, ...args: unknown[]) {
    const sibling = findSibling(request);
    if (sibling !== null) {
      return sibling;
    }
    return originalResolve.call(this, request, ...args);
  };
}

// Patch process.dlopen as a safety net.
const originalDlopen = process.dlopen.bind(process);
process.dlopen = function patchedDlopen(
  module: { exports: Record<string, unknown> },
  filename: string,
  flags?: number,
) {
  const sibling = findSibling(filename);
  if (sibling !== null) {
    return originalDlopen(module, sibling, flags);
  }
  return originalDlopen(module, filename, flags);
};

// Now import the actual entry point — native addons will be resolved correctly
await import("./index.js");
