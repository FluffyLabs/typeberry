#!/usr/bin/env tsx

/**
 * @typeberry/lib Build Script
 *
 * This script post-processes the TypeScript compilation output to create a distributable
 * package using package.json "imports" field for internal package resolution.
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
 *    - Converts workspace imports to internal imports by prepending #:
 *      - `@typeberry/bytes` → `#@typeberry/bytes`
 *      - `@typeberry/pvm-interpreter/ops/math-consts.js` → `#@typeberry/pvm-interpreter/ops/math-consts.js`
 *    - Preserves subpaths in imports (e.g., package/submodule)
 *
 * 4. **Package.json Generation**
 *    - Copies bin/lib/package.json and transforms it for distribution:
 *      - Updates `main` and `types` to point to `./bin/lib/index.js` and `./bin/lib/index.d.ts`
 *      - Transforms `exports` to include both types and default fields
 *      - Removes workspace dependencies
 *      - Adds `imports` field to map `#<package-name>/*` to actual package locations
 *
 * 5. **Distribution Files**
 *    - Copies README.md to dist/lib/
 *    - Copies .npmignore to dist/lib/
 *
 * ## Why Package.json Imports?
 *
 * The compiled package uses the "imports" field because:
 * - It provides a clean, maintainable way to handle internal package references
 * - No need for complex relative path calculations
 * - Node.js natively resolves these imports
 * - Easier to understand and debug
 *
 * ## Output Structure
 *
 * ```
 * dist/lib/
 * ├── package.json       (with "imports" field mapping #<package-name>/* to paths)
 * ├── README.md          (copied from bin/lib/)
 * ├── .npmignore         (copied from bin/lib/)
 * ├── bin/lib/           (compiled @typeberry/lib entry points)
 * │   ├── index.js
 * │   ├── index.d.ts
 * │   └── exports/       (re-export files with # prefixed imports)
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

  if (rootPackageJson.workspaces === undefined || rootPackageJson.workspaces === null) {
    throw new Error("No workspaces found in root package.json");
  }

  const packageMap: Record<string, string> = {};

  for (const workspacePath of rootPackageJson.workspaces) {
    const packageJsonPath = path.join(ROOT_DIR, workspacePath, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      // biome-ignore lint/suspicious/noConsole: Build script requires console output
      console.warn(`Warning: No package.json found at ${workspacePath}`);
      continue;
    }

    const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    if (packageJson.name !== undefined && packageJson.name !== null && packageJson.name !== "") {
      packageMap[packageJson.name] = workspacePath;
    }
  }

  return packageMap;
}

/**
 * Extract package name from an import path
 *
 * Handles both scoped and non-scoped packages:
 * - Scoped: "@typeberry/bytes" → "@typeberry/bytes"
 * - Scoped with subpath: "@typeberry/bytes/something.js" → "@typeberry/bytes"
 * - Non-scoped: "lodash" → "lodash"
 * - Non-scoped with subpath: "lodash/map.js" → "lodash"
 *
 * @param importPath - The import path to extract from
 * @returns The package name
 */
function extractPackageName(importPath: string): string {
  if (importPath.startsWith("@")) {
    // Scoped package: take first two segments (@scope/name)
    const match = importPath.match(/^(@[^/]+\/[^/]+)/);
    return match !== null ? match[1] : importPath;
  }
  // Non-scoped package: take first segment
  const match = importPath.match(/^([^/]+)/);
  return match !== null ? match[1] : importPath;
}

/**
 * Rewrite imports in a JavaScript or TypeScript declaration file
 *
 * Searches for all import/export statements and checks if they reference
 * packages in the package map. If so, rewrites them to use # prefix
 * which is resolved via package.json "imports" field.
 *
 * Handles both import and export statements:
 * - `import { X } from "@typeberry/bytes"` → `import { X } from "#@typeberry/bytes"`
 * - `export * from "@typeberry/codec"` → `export * from "#@typeberry/codec"`
 *
 * External packages not in the package map are left unchanged.
 *
 * @param filePath - Absolute path to the file to process
 * @param packageMap - Map of package names to their workspace paths
 */
function rewriteImports(filePath: string, packageMap: Record<string, string>): void {
  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  // Match: import ... from "...";
  // Match: export ... from "...";
  const importRegex = /((?:import|export)\s+(?:[\s\S]*?)\s+from\s+["'])([^"']+)(["'])/g;

  content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
    // Skip relative imports
    if (typeof importPath === "string" && importPath.startsWith(".")) {
      return match;
    }

    // Extract the package name from the import path
    const packageName = extractPackageName(importPath);

    // Only rewrite if this package is in our workspace
    if (packageMap[packageName] !== undefined && packageMap[packageName] !== "") {
      modified = true;
      // Prepend # to the import path
      const newImportPath = `#${importPath}`;
      return `${prefix}${newImportPath}${suffix}`;
    }

    // External package - leave unchanged
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
 * Build the "imports" field for package.json
 *
 * Creates mappings from #<package-name>/* to the actual package locations in dist/lib/.
 * Each package gets two entries:
 * - Direct import: "#@typeberry/bytes" → "./packages/core/bytes/index.js"
 * - Subpath import: "#@typeberry/bytes/*" → "./packages/core/bytes/*.js"
 *
 * @param packageMap - Map of package names to their workspace paths
 * @returns The imports field object for package.json
 *
 * @example
 * {
 *   "#@typeberry/bytes": "./packages/core/bytes/index.js",
 *   "#@typeberry/bytes/*": "./packages/core/bytes/*.js",
 *   "#@typeberry/codec": "./packages/core/codec/index.js",
 *   "#@typeberry/codec/*": "./packages/core/codec/*.js"
 * }
 */
function buildImportsField(packageMap: Record<string, string>): Record<string, string> {
  const imports: Record<string, string> = {};

  for (const [packageName, packagePath] of Object.entries(packageMap)) {
    // Prepend # to package name
    const internalName = `#${packageName}`;

    // Direct import (e.g., import from "#@typeberry/bytes")
    imports[internalName] = `./${packagePath}/index.js`;

    // Subpath imports (e.g., import from "#@typeberry/bytes/something.js")
    imports[`${internalName}/*`] = `./${packagePath}/*`;
  }

  return imports;
}

/**
 * Create and fix the package.json at dist/lib
 *
 * Transforms the source package.json from bin/lib/ into a distribution-ready format:
 * - Updates entry points to use ./bin/lib/ prefix
 * - Adds TypeScript type declarations to exports
 * - Removes workspace dependencies
 * - Adds "imports" field to resolve #<package-name>/* references
 *
 * The resulting package.json uses the "exports" format with separate
 * type and default exports for each module, and an "imports" field for
 * internal package resolution.
 *
 * @param packageMap - Map of package names to their workspace paths
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
 *
 * // Output imports:
 * {
 *   "imports": {
 *     "#@typeberry/bytes": "./packages/core/bytes/index.js",
 *     "#@typeberry/bytes/*": "./packages/core/bytes/*.js",
 *     ...
 *   }
 * }
 */
function createDistPackageJson(packageMap: Record<string, string>): void {
  const sourcePackageJsonPath = path.join(ROOT_DIR, "bin/lib/package.json");
  const targetPackageJsonPath = path.join(DIST_DIR, "package.json");

  const sourcePackageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath, "utf-8"));

  // Filter out workspace dependencies
  const filteredDeps = Object.entries(sourcePackageJson.dependencies).filter(([_key, version]) => version !== "*");

  // Create the new package.json structure
  const distPackageJson: {
    name: string;
    version: string;
    description: string;
    main: string;
    types: string;
    type: string;
    exports: Record<string, unknown>;
    imports: Record<string, string>;
    dependencies: Record<string, unknown>;
    author: string;
    license: string;
  } = {
    name: sourcePackageJson.name,
    version: sourcePackageJson.version,
    description: sourcePackageJson.description,
    main: "./bin/lib/index.js",
    types: "./bin/lib/index.d.ts",
    type: sourcePackageJson.type,
    exports: {},
    imports: buildImportsField(packageMap),
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
  fs.writeFileSync(targetPackageJsonPath, `${JSON.stringify(distPackageJson, null, 2)}\n`);
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
// 2. Rewrite all workspace package imports to #<package-name>/* in .js and .d.ts files
// 3. Create a distribution package.json with "imports" field for resolution
// 4. Copy README.md and .npmignore for npm publishing

console.log("Building package map from workspace configuration...");
const packageMap = buildPackageMap();
console.log(`Found ${Object.keys(packageMap).length} packages in workspace`);

console.log("\nRewriting workspace imports to internal imports...");
console.log(`Processing: ${DIST_DIR}`);

if (!fs.existsSync(DIST_DIR)) {
  // biome-ignore lint/suspicious/noConsole: Build script requires console output
  console.error(`Error: Directory not found: ${DIST_DIR}`);
  // biome-ignore lint/suspicious/noConsole: Build script requires console output
  console.error("Please run TypeScript compilation (tsc) first.");
  process.exit(1);
}

processDirectory(DIST_DIR, packageMap);

console.log("\nCreating distribution package.json with imports field...");
createDistPackageJson(packageMap);

console.log("\nCopying distribution files...");
copyDistributionFiles();

console.log("\n✓ Build complete!");
