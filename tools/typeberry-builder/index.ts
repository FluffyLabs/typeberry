import * as fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";
import webpackConfig from "./webpack.config.js";

const commitHash = process.env.SHORT_SHA;
if (commitHash === undefined) {
  throw new Error("Missing 'SHORT_SHA' environment variable");
}

console.info(`🪢 Current commit hash: ${commitHash}\n`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const relPath = resolve(__dirname, "../..");

const DIST_DIR = "dist/typeberry";

async function createDistDirectory() {
  const distPath = resolve(__dirname, DIST_DIR);
  await fs.mkdir(distPath, { recursive: true });
  console.info("📁 Created dist/typeberry directory");
}

async function copyWasmFiles() {
  console.info("\n📦 Copying WASM files...");

  const wasmFiles = [
    { name: "ed25519_wasm_bg.wasm", path: "ed25519-wasm/pkg" },
    { name: "reed_solomon_wasm_bg.wasm", path: "reed-solomon-wasm/pkg" },
  ];

  const srcDir = resolve(relPath, "node_modules");
  const destDir = resolve(relPath, DIST_DIR);

  for (const wasmFile of wasmFiles) {
    const srcPath = resolve(srcDir, wasmFile.path, wasmFile.name);
    const destPath = resolve(destDir, wasmFile.name);

    try {
      await fs.copyFile(srcPath, destPath);
      console.info(` - Copied ${wasmFile.name}`);
    } catch (error) {
      console.warn(`🫣 Could not copy ${wasmFile.name}:`, error);
    }
  }
}

async function createNpmPackage() {
  console.info("\n📦 Creating npm package...");

  const destDir = resolve(relPath, DIST_DIR);

  const rootPkgPath = resolve(relPath, "package.json");
  const rootPkg = JSON.parse(await fs.readFile(rootPkgPath, "utf8"));

  const lockPkgPath = resolve(relPath, "package-lock.json");
  const lockPkg = JSON.parse(await fs.readFile(lockPkgPath, "utf8"));

  const version = `${rootPkg.version}-${commitHash}`;

  const files = await fs.readdir(destDir);
  const mainFile = files.find((file) => file === "typeberry.mjs");

  if (mainFile === undefined) {
    throw new Error("Could not find built typeberry main file");
  }

  // Create package.json
  const packageJson = {
    name: rootPkg.name,
    version: version,
    description: rootPkg.description,
    main: mainFile,
    bin: {
      typeberry: mainFile,
    },
    type: "module",
    author: rootPkg.author,
    license: rootPkg.license,
    dependencies: {
      minimist: lockPkg.packages["node_modules/minimist"],
      lmdb: lockPkg.packages["node_modules/lmdb"],
    },
    files: ["*.mjs", "*.wasm", "*.txt"],
  };

  // Create package.json
  const packageJsonPath = resolve(destDir, "package.json");
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.info(" - Created package.json");
}

async function build() {
  console.info("🚀 Starting typeberry build...");
  console.info("📦 Building in production mode...");

  try {
    await createDistDirectory();

    const config = webpackConfig;
    const compiler = webpack(config);

    await new Promise<void>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err !== null) {
          reject(err);
          return;
        }

        if (stats?.hasErrors() === true) {
          const errors = stats.toJson().errors;
          console.error("❌ Build failed with errors:");
          if (errors !== undefined) {
            for (const error of errors) {
              console.error(error.message);
            }
          }
          reject(new Error("Build failed"));
          return;
        }

        console.info("✅ Build completed successfully!\n");

        if (stats !== undefined) {
          // Printing stats & warnings
          console.info(
            stats.toString({
              colors: true,
              modules: false,
              chunks: false,
              chunkModules: false,
            }),
          );
        }

        resolve();
      });
    });

    await copyWasmFiles();
    await createNpmPackage();

    console.info("\n🎉 Typeberry build complete!");
  } catch (error) {
    console.error("💥 Build failed:", error);
    process.exit(1);
  }
}

build().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
