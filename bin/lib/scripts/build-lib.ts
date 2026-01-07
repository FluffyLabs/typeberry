#!/usr/bin/env tsx

/**
 * @typeberry/lib Build Script
 *
 * This script post-processes the TypeScript compilation output to create a distributable
 * package with relative imports instead of workspace imports.
 *
 * ## Build Process Overview
 *
 * 1. **TypeScript Compilation**
 *    - First, `tsc` compiles all TypeScript files to JavaScript in `dist/lib/`
 *    - This produces .js, .d.ts, and .d.ts.map files
 *    - Imports remain as workspace references (e.g., `@typeberry/bytes`)
 *
 * 2. **Package Discovery**
 *    - Reads the root package.json to discover all workspace packages
 *    - Builds a map of package names to their filesystem paths
 *    - Example: `@typeberry/bytes` → `packages/core/bytes`
 *
 * 3. **Import Rewriting**
 *    - Recursively processes all .js and .d.ts files in dist/lib/
 *    - Converts workspace imports to relative paths:
 *      - `@typeberry/bytes` → `../../../packages/core/bytes/index.js`
 *      - `@typeberry/pvm-interpreter/ops/math-consts.js` → `../../../core/pvm-interpreter/ops/math-consts.js`
 *    - Preserves subpaths in imports (e.g., package/submodule)
 *
 * 4. **Package.json Generation**
 *    - Copies bin/lib/package.json and transforms it for distribution:
 *      - Updates `main` and `types` to point to `./bin/lib/index.js` and `./bin/lib/index.d.ts`
 *      - Transforms `exports` to include both types and default fields
 *      - Removes workspace dependencies
 *      - Adds `@typeberry/native` dependency from crypto package
 *
 * 5. **Distribution Files**
 *    - Copies README.md to dist/lib/
 *    - Copies .npmignore to dist/lib/
 *
 * ## Why Relative Imports?
 *
 * The compiled package needs relative imports because:
 * - npm doesn't understand workspace references
 * - All packages are bundled together in dist/lib/
 * - Relative paths work in any environment without workspace configuration
 *
 * ## Output Structure
 *
 * ```
 * dist/lib/
 * ├── package.json       (transformed with relative paths)
 * ├── README.md          (copied from bin/lib/)
 * ├── .npmignore         (copied from bin/lib/)
 * ├── bin/lib/           (compiled @typeberry/lib entry points)
 * │   ├── index.js
 * │   ├── index.d.ts
 * │   └── exports/       (re-export files with relative imports)
 * └── packages/          (all compiled workspace packages)
 *     ├── core/
 *     ├── jam/
 *     └── workers/
 * ```
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "../../..");
const DIST_DIR = path.resolve(ROOT_DIR, "dist/lib");

interface PackageJson {
  name?: string;
  workspaces?: string[];
}

/**
 * Build a map of package names to their workspace paths
 *
 * Reads the root package.json and discovers all workspace packages by reading each
 * workspace's package.json file. This creates a mapping used for import rewriting.
 *
 * @returns A map from package names (e.g., "@typeberry/bytes") to workspace paths
 *          (e.g., "packages/core/bytes")
 *
 * @example
 * {
 *   "@typeberry/bytes": "packages/core/bytes",
 *   "@typeberry/codec": "packages/core/codec",
 *   ...
 * }
 */
function buildPackageMap(): Record<string, string> {
  const rootPackageJsonPath = path.join(ROOT_DIR, "package.json");
  const rootPackageJson: PackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, "utf-8"));

  if (!rootPackageJson.workspaces) {
    throw new Error("No workspaces found in root package.json");
  }

  const packageMap: Record<string, string> = {};

  for (const workspacePath of rootPackageJson.workspaces) {
    const packageJsonPath = path.join(ROOT_DIR, workspacePath, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      console.warn(`Warning: No package.json found at ${workspacePath}`);
      continue;
    }

    const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    if (packageJson.name && packageJson.name.startsWith("@typeberry/")) {
      packageMap[packageJson.name] = workspacePath;
    }
  }

  return packageMap;
}

/**
 * Convert workspace import to relative path
 *
 * Transforms a workspace import (e.g., "@typeberry/bytes") into a relative path
 * based on the current file's location and the package map.
 *
 * Supports both simple imports and imports with subpaths:
 * - Simple: "@typeberry/bytes" → "../../../packages/core/bytes/index.js"
 * - Subpath: "@typeberry/pvm-interpreter/ops/math.js" → "../../../core/pvm-interpreter/ops/math.js"
 *
 * @param importPath - The import path to convert (e.g., "@typeberry/bytes")
 * @param fromFile - The absolute path of the file containing the import
 * @param packageMap - Map of package names to their workspace paths
 * @returns The relative path to use in the import, or the original path if not convertible
 *
 * @example
 * // From: dist/lib/bin/lib/exports/bytes.js
 * // Import: "@typeberry/codec"
 * // Returns: "../../../packages/core/codec/index.js"
 *
 * @example
 * // From: dist/lib/packages/jam/jam-host-calls/accumulate/bless.test.js
 * // Import: "@typeberry/pvm-interpreter/ops/math-consts.js"
 * // Returns: "../../../core/pvm-interpreter/ops/math-consts.js"
 */
function convertImportPath(importPath: string, fromFile: string, packageMap: Record<string, string>): string {
  if (!importPath.startsWith("@typeberry/")) {
    return importPath;
  }

  // Extract the package name and any subpath
  // Example: "@typeberry/pvm-interpreter/ops/math-consts.js"
  // -> packageName = "@typeberry/pvm-interpreter", subPath = "/ops/math-consts.js"
  const match = importPath.match(/^(@typeberry\/[^/]+)(\/.*)?$/);

  if (!match) {
    console.warn(`Warning: Invalid package path format: ${importPath} at ${fromFile}`);
    return importPath;
  }

  const [, packageName, subPath = ""] = match;
  const packagePath = packageMap[packageName];

  if (!packagePath) {
    console.warn(`Warning: No mapping found for ${packageName} at ${fromFile}`);
    return importPath;
  }

  // Calculate relative path from the current file to the package
  const fromDir = path.dirname(fromFile);

  // If there's a subpath, append it; otherwise, use index.js
  const targetPath = subPath
    ? path.join(DIST_DIR, packagePath, subPath)
    : path.join(DIST_DIR, packagePath, "index.js");

  let relativePath = path.relative(fromDir, targetPath);

  // Ensure the path starts with ./
  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath;
  }

  // Use forward slashes for imports
  relativePath = relativePath.replace(/\\/g, "/");

  return relativePath;
}

/**
 * Rewrite imports in a JavaScript or TypeScript declaration file
 *
 * Searches for all import/export statements that reference @typeberry packages
 * and replaces them with relative paths.
 *
 * Handles both import and export statements:
 * - `import { X } from "@typeberry/bytes"`
 * - `export * from "@typeberry/codec"`
 *
 * @param filePath - Absolute path to the file to process
 * @param packageMap - Map of package names to their workspace paths
 */
function rewriteImports(filePath: string, packageMap: Record<string, string>): void {
  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  // Match: import ... from "@typeberry/...";
  // Match: export ... from "@typeberry/...";
  const importRegex = /((?:import|export)\s+(?:[\s\S]*?)\s+from\s+["'])(@typeberry\/[^"']+)(["'])/g;

  content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
    const newPath = convertImportPath(importPath, filePath, packageMap);
    if (newPath !== importPath) {
      modified = true;
      return prefix + newPath + suffix;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Rewrote imports in ${path.relative(DIST_DIR, filePath)}`);
  }
}

/**
 * Recursively process all JS and DTS files in a directory
 *
 * Walks the directory tree and rewrites imports in all .js and .d.ts files.
 *
 * @param dir - Directory to process
 * @param packageMap - Map of package names to their workspace paths
 */
function processDirectory(dir: string, packageMap: Record<string, string>): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      processDirectory(fullPath, packageMap);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts"))) {
      rewriteImports(fullPath, packageMap);
    }
  }
}

/**
 * Create and fix the package.json at dist/lib
 *
 * Transforms the source package.json from bin/lib/ into a distribution-ready format:
 * - Updates entry points to use ./bin/lib/ prefix
 * - Adds TypeScript type declarations to exports
 * - Removes workspace dependencies
 *
 * The resulting package.json uses the "exports" format with separate
 * type and default exports for each module.
 *
 * @example
 * // Input exports (from bin/lib/package.json):
 * {
 *   "./bytes": "./exports/bytes.js"
 * }
 *
 * // Output exports (in dist/lib/package.json):
 * {
 *   "./bytes": {
 *     "types": "./bin/lib/exports/bytes.d.ts",
 *     "default": "./bin/lib/exports/bytes.js"
 *   }
 * }
 */
function createDistPackageJson(): void {
  const sourcePackageJsonPath = path.join(ROOT_DIR, "bin/lib/package.json");
  const targetPackageJsonPath = path.join(DIST_DIR, "package.json");

  const sourcePackageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath, "utf-8"));

  // Filter out workspace dependencies
  const filteredDeps = Object.entries(sourcePackageJson.dependencies)
    .filter(([_key, version]) => version !== "*");

  // Create the new package.json structure
  const distPackageJson: any = {
    name: sourcePackageJson.name,
    version: sourcePackageJson.version,
    description: sourcePackageJson.description,
    main: "./bin/lib/index.js",
    types: "./bin/lib/index.d.ts",
    type: sourcePackageJson.type,
    exports: {},
    dependencies: Object.fromEntries(filteredDeps),
    author: sourcePackageJson.author,
    license: sourcePackageJson.license,
  };

  // Fix the exports paths to include bin/lib/ prefix and add types
  for (const [key, value] of Object.entries(sourcePackageJson.exports)) {
    if (typeof value === "string") {
      if (key === ".") {
        distPackageJson.exports[key] = {
          types: "./bin/lib/index.d.ts",
          default: "./bin/lib/index.js",
        };
      } else {
        // Convert path like "./exports/bytes.js" to "./bin/lib/exports/bytes.js"
        const jsPath = `./bin/lib${value.startsWith("./") ? value.slice(1) : value}`;
        // Replace .js with .d.ts for types
        const dtsPath = jsPath.replace(/\.js$/, ".d.ts");

        distPackageJson.exports[key] = {
          types: dtsPath,
          default: jsPath,
        };
      }
    }
  }

  // Write the new package.json
  fs.writeFileSync(targetPackageJsonPath, JSON.stringify(distPackageJson, null, 2) + "\n");
  console.log(`✓ Created ${path.relative(ROOT_DIR, targetPackageJsonPath)}`);
}

/**
 * Copy additional distribution files (README, .npmignore, etc.)
 *
 * Copies files needed for npm distribution from bin/lib/ to dist/lib/:
 * - README.md: Package documentation
 * - .npmignore: Files to exclude from npm publish
 *
 * Files are only copied if they exist in the source location. Missing files
 * are skipped without error.
 */
function copyDistributionFiles(): void {
  const binLibDir = path.join(ROOT_DIR, "bin/lib");

  // Copy README.md
  const readmeSrc = path.join(binLibDir, "README.md");
  const readmeDest = path.join(DIST_DIR, "README.md");
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, readmeDest);
    console.log(`✓ Copied ${path.relative(ROOT_DIR, readmeDest)}`);
  }

  // Copy .npmignore if it exists
  const npmignoreSrc = path.join(binLibDir, ".npmignore");
  const npmignoreDest = path.join(DIST_DIR, ".npmignore");
  if (fs.existsSync(npmignoreSrc)) {
    fs.copyFileSync(npmignoreSrc, npmignoreDest);
    console.log(`✓ Copied ${path.relative(ROOT_DIR, npmignoreDest)}`);
  }
}

// ============================================================================
// Main Execution
// ============================================================================
//
// This script runs after TypeScript compilation (tsc) to post-process the
// output and create a distributable package.
//
// Prerequisites:
// - TypeScript must have already compiled the project to dist/lib/
// - The workspace must be properly configured in the root package.json
//
// Process:
// 1. Discover all workspace packages by reading package.json files
// 2. Rewrite all @typeberry/* imports to relative paths in .js and .d.ts files
// 3. Create a distribution package.json with proper exports and dependencies
// 4. Copy README.md and .npmignore for npm publishing

console.log("Building package map from workspace configuration...");
const packageMap = buildPackageMap();
console.log(`Found ${Object.keys(packageMap).length} packages in workspace`);

console.log("\nRewriting workspace imports to relative paths...");
console.log(`Processing: ${DIST_DIR}`);

if (!fs.existsSync(DIST_DIR)) {
  console.error(`Error: Directory not found: ${DIST_DIR}`);
  console.error("Please run TypeScript compilation (tsc) first.");
  process.exit(1);
}

processDirectory(DIST_DIR, packageMap);

console.log("\nCreating distribution package.json...");
createDistPackageJson();

console.log("\nCopying distribution files...");
copyDistributionFiles();

console.log("\n✓ Build complete!");
