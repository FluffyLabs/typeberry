const fs = require("node:fs");
const childProcess = require("node:child_process");

const packageToBuild = process.env.PACKAGE_NAME;
let outDir = process.env.PACKAGE_OUT;

if (!packageToBuild) {
  throw new Error(`Missing 'PACKAGE_NAME' environment variable.`);
}

if (!outDir) {
  const parts = packageToBuild.split("/");
  outDir = parts[parts.length - 1];
}

const data = `export * from "${packageToBuild}";`;
fs.writeFileSync(`${__dirname}/pkg.ts`, data);

const DIST = `${__dirname}/../../dist/${outDir}`;

const commitHashResult = childProcess.execSync("git rev-parse --short HEAD");
const originalPackageJson = require(`${packageToBuild}/package.json`);
// generate package.json
const packageJson = JSON.stringify(
  {
    name: packageToBuild,
    version: `${originalPackageJson.version}-${commitHashResult.toString("utf8").trim()}`,
    main: "index.js",
    author: originalPackageJson.author,
    license: originalPackageJson.license,
  },
  null,
  2,
);
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(`${DIST}/package.json`, packageJson);

fs.writeFileSync(
  `${DIST}/.npmignore`,
  `tools/**
packages/**
`,
);

module.exports = {
  outFile: `${DIST}/index.js`,
  typesInput: `${DIST}/tools/builder/pkg.d.ts`,
};
