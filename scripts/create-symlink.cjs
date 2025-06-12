#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "../dist");

try {
  // Find the versioned .cjs file
  const files = fs.readdirSync(distDir);
  const versionedFile = files.find((file) => file.startsWith("typeberry-v") && file.endsWith(".cjs"));

  if (!versionedFile) {
    console.error("No versioned typeberry .cjs file found in dist/");
    process.exit(1);
  }

  const sourcePath = path.join(distDir, versionedFile);
  const targetPath = path.join(distDir, "typeberry.cjs");

  // Copy the file
  fs.copyFileSync(sourcePath, targetPath);

  // Make it executable
  fs.chmodSync(targetPath, "755");

  console.info(`Created typeberry.cjs from ${versionedFile}`);
} catch (error) {
  console.error("Error creating symlink:", error.message);
  process.exit(1);
}
