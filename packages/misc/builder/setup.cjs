const fs = require("node:fs");
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
const inputFile = `${__dirname}/pkg.ts`;

const data = `export * from "${packageToBuild}";`;
fs.writeFileSync(inputFile, data);

const commitHashResult = childProcess.execSync("git rev-parse --short HEAD");
const originalPackageJson = require(`${packageToBuild}/package.json`);
// generate package.json
const packageJson = JSON.stringify(
  {
    name: packageToBuild,
    version: isRelease
      ? originalPackageJson.version
      : `${originalPackageJson.version}-${commitHashResult.toString("utf8").trim()}`,
    main: "index.cjs",
    author: originalPackageJson.author,
    license: originalPackageJson.license,
    sideEffects: false,
    exports: {
      ".": {
        import: "./index.mjs",
        require: "./index.cjs",
      },
    },
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
`,
);

module.exports = {
  inputFile,
  esmOutFile: `${DIST}/index.mjs`,
  cjsOutFile: `${DIST}/index.cjs`,
  typesInput: inputFile,
};
