const fs = require("node:fs");

const packageToBuild = process.env.PACKAGE_NAME;
const outFile = process.env.PACKAGE_OUT;

if (!packageToBuild) {
  throw new Error(`Missing 'PACKAGE_NAME' environment variable.`);
}

if (!outFile) {
  throw new Error(`Missing 'PACKAGE_OUT' environment variable.`);
}

const data = `export * from "${packageToBuild}";`;
fs.writeFileSync(`${__dirname}/pkg.ts`, data);

module.exports = `${__dirname}/../../dist/${outFile}.js`;
