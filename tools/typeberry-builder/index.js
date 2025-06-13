#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";
import webpackConfig from "./webpack.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createDistDirectory() {
  const distPath = resolve(__dirname, "../../dist/typeberry");
  try {
    await fs.mkdir(distPath, { recursive: true });
    console.info("📁 Created dist/typeberry directory");
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

async function copyWasmFiles() {
  console.info("\n📦 Copying WASM files...");

  const wasmFiles = [
    { name: "ed25519_wasm_bg.wasm", path: "ed25519-wasm/pkg" },
    { name: "bandersnatch_wasm_bg.wasm", path: "bandersnatch-wasm/pkg" },
    { name: "reed_solomon_wasm_bg.wasm", path: "reed-solomon-wasm/pkg" },
  ];

  const srcDir = resolve(__dirname, "../../node_modules/");
  const destDir = resolve(__dirname, "../../dist/typeberry");

  for (const wasmFile of wasmFiles) {
    const srcPath = resolve(srcDir, wasmFile.path, wasmFile.name);
    const destPath = resolve(destDir, wasmFile.name);

    try {
      await fs.copyFile(srcPath, destPath);
      console.info(` - Copied ${wasmFile.name}`);
    } catch (error) {
      console.warn(`🫣 Could not copy ${wasmFile.name}:`, error.message);
    }
  }
}

async function createNpmPackage() {
  console.info("\n📦 Creating npm package...");

  const destDir = resolve(__dirname, "../../dist/typeberry");

  const rootPkgPath = resolve(__dirname, "../../package.json");
  const rootPkg = JSON.parse(await fs.readFile(rootPkgPath, "utf-8"));

  const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
  const version = `${rootPkg.version}-${commitHash}`;

  const files = await fs.readdir(destDir);
  const mainFile = files.find((file) => file === "typeberry.mjs");

  if (!mainFile) {
    throw new Error("Could not find built typeberry main file");
  }

  // Create package.json
  const packageJson = {
    name: rootPkg.name,
    version: version,
    description: rootPkg.description,
    main: mainFile,
    type: "module",
    author: rootPkg.author,
    license: rootPkg.license,
    dependencies: {
      minimist: "^1.2.8",
      lmdb: "^3.1.3",
    },
    files: ["*.mjs", "*.wasm", "*.txt"],
  };

  // Create package.json
  const packageJsonPath = resolve(destDir, "package.json");
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.info(" - Created package.json");

  // Create .npmignore
  const npmignore = `*.map`;
  const npmignorePath = resolve(destDir, ".npmignore");
  await fs.writeFile(npmignorePath, npmignore);
  console.info(" - Created .npmignore");
}

async function build() {
  console.info("🚀 Starting typeberry build...");

  const args = process.argv.slice(2);
  const isProduction = !args.includes("--mode") || args.includes("production");
  const mode = isProduction ? "production" : "development";

  console.info(`📦 Building in ${mode} mode...`);

  try {
    await createDistDirectory();

    const config = webpackConfig({}, { mode });
    const compiler = webpack(config);

    await new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        if (stats.hasErrors()) {
          const errors = stats.toJson().errors;
          console.error("❌ Build failed with errors:");
          for (const error of errors) {
            console.error(error.message);
          }
          reject(new Error("Build failed"));
          return;
        }

        console.info("✅ Build completed successfully!\n");

        // Printing stats & warnings
        console.info(
          stats.toString({
            colors: true,
            modules: false,
            chunks: false,
            chunkModules: false,
          }),
        );

        resolve();
      });
    });

    await copyWasmFiles();
    await createNpmPackage();

    console.info("\n🎉 Typeberry build complete!");
  } catch (error) {
    console.error("💥 Build failed:", error.message);
    process.exit(1);
  }
}

build().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
