const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const packageToBuild = process.env.PACKAGE_NAME;
let outDir = process.env.PACKAGE_OUT;

const isRelease = process.env.IS_RELEASE !== undefined;

if (!packageToBuild) {
  throw new Error(`Missing 'PACKAGE_NAME' environment variable.`);
}

if (!outDir) {
  const parts = packageToBuild.split("/");
  outDir = parts[parts.length - 1];
}

const DIST = `${__dirname}/../../../dist/${outDir}`;

// Find the package source directory
const packagePath = require.resolve(`${packageToBuild}/package.json`);
const packageDir = path.dirname(packagePath);
const originalPackageJson = require(`${packageToBuild}/package.json`);

// Read subpath exports from source package.json instead of scanning directory
const sourceExports = originalPackageJson.exports || {};
const subpathExports = [];

// Get the main export source file
let mainExportSource = null;
const mainExport = sourceExports["."];
if (mainExport) {
  const mainSourcePath =
    typeof mainExport === "string" ? mainExport : mainExport.default || mainExport.import || mainExport;
  if (mainSourcePath && typeof mainSourcePath === "string") {
    mainExportSource = path.join(packageDir, mainSourcePath);
  }
}

for (const [exportPath, exportValue] of Object.entries(sourceExports)) {
  // Skip the main export (".") and package.json
  if (exportPath === "." || exportPath === "./package.json") {
    continue;
  }

  // Extract the subpath name (e.g., "./block" -> "block")
  const subpathName = exportPath.replace(/^\.\//, "");

  // Get the source file path
  const sourcePath =
    typeof exportValue === "string" ? exportValue : exportValue.default || exportValue.import || exportValue;

  if (sourcePath && typeof sourcePath === "string") {
    subpathExports.push({
      name: subpathName,
      sourcePath: path.join(packageDir, sourcePath),
    });
  }
}

// Use the actual source file for main export, or generate a simple re-export
let inputFile;
if (mainExportSource && fs.existsSync(mainExportSource)) {
  inputFile = mainExportSource;
} else {
  // Fallback for packages without explicit source files
  inputFile = `${__dirname}/pkg.ts`;
  const data = `export * from "${packageToBuild}";`;
  fs.writeFileSync(inputFile, data);
}

const commitHashResult = childProcess.execSync("git rev-parse --short HEAD");

// Build exports field
const exportsField = {
  ".": {
    types: "./index.d.ts",
    import: "./index.mjs",
    require: "./index.cjs",
  },
};

// Add subpath exports from source package.json
for (const subpath of subpathExports) {
  exportsField[`./${subpath.name}`] = {
    types: `./${subpath.name}.d.ts`,
    import: `./${subpath.name}.mjs`,
    require: `./${subpath.name}.cjs`,
  };
}

// generate package.json
const packageJson = JSON.stringify(
  {
    name: packageToBuild,
    version: isRelease
      ? originalPackageJson.version
      : `${originalPackageJson.version}-${commitHashResult.toString("utf8").trim()}`,
    main: "index.cjs",
    types: "index.d.ts",
    author: originalPackageJson.author,
    license: originalPackageJson.license,
    sideEffects: false,
    exports: exportsField,
  },
  null,
  2,
);
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(`${DIST}/package.json`, packageJson);

fs.writeFileSync(
  `${DIST}/.npmignore`,
  `
bin/**
packages/**
.noop*
`,
);

// Return configuration for all entry points
const entries = [
  {
    name: "index",
    inputFile,
    esmOutFile: `${DIST}/index.mjs`,
    cjsOutFile: `${DIST}/index.cjs`,
    typesInput: inputFile,
  },
];

// Add subpath entries from source package.json
for (const subpath of subpathExports) {
  const sourceContent = fs.readFileSync(subpath.sourcePath, "utf-8").trim();

  // Extract the package name from the export statement
  const match = sourceContent.match(/export \* from ["']([^"']+)["']/);
  if (!match) {
    // Skip files that don't match the expected export pattern
    continue;
  }

  const packageName = match[1];

  // Generate files directly without rollup (simple re-exports don't need bundling)
  // ESM (.mjs)
  fs.writeFileSync(`${DIST}/${subpath.name}.mjs`, `export * from "${packageName}";\n`);

  // CommonJS (.cjs)
  fs.writeFileSync(`${DIST}/${subpath.name}.cjs`, `module.exports = require("${packageName}");\n`);

  // TypeScript declarations (.d.ts)
  fs.writeFileSync(`${DIST}/${subpath.name}.d.ts`, `export * from "${packageName}";\n`);

  // Don't add to rollup entries (already generated)
}

module.exports = {
  entries,
  DIST,
};
