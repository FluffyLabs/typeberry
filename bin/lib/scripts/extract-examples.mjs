#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXAMPLES_DIR = path.join(__dirname, "../examples");
const README_PATH = path.join(__dirname, "../README.md");

/**
 * Convert dynamic imports to static imports for documentation
 */
function convertDynamicImportsToStatic(code) {
  // Match patterns like: const { X, Y } = await import("@typeberry/lib/module");
  const dynamicImportRegex = /const\s+\{([^}]+)\}\s+=\s+await\s+import\s*\(\s*["']([^"']+)["']\s*\)\s*;?/g;

  // Collect all imports
  const imports = [];
  const importMap = new Map();

  let match;
  const regex = new RegExp(dynamicImportRegex);
  for (match of code.matchAll(regex)) {
    const [fullMatch, importsMatch, modulePathMatch] = match;
    if (!importMap.has(modulePath)) {
      importMap.set(modulePath, []);
    }
    // Split and clean import names
    const importNames = imports_
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    importMap.get(modulePath).push(...importNames);

    imports.push({ fullMatch, modulePath, imports: importNames });
  }

  // Remove duplicate imports and build static import statements
  const staticImports = [];
  for (const [modulePath, importNames] of importMap) {
    // Remove duplicates
    const uniqueImports = [...new Set(importNames)];
    staticImports.push(`import { ${uniqueImports.join(", ")} } from "${modulePath}";`);
  }

  // Remove all dynamic import lines
  let result = code;
  for (const { fullMatch } of imports) {
    result = result.replace(fullMatch, "");
  }

  // Clean up excessive blank lines (more than 1 consecutive blank line)
  result = result.replace(/\n\n\n+/g, "\n\n");

  // Remove empty lines at the start
  const lines = result.split("\n");
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  result = lines.join("\n");

  // Prepend static imports if any exist
  if (staticImports.length > 0) {
    result = `${staticImports.join("\n")}\n\n${result}`;
  }

  return result;
}

/**
 * Extract code examples from test files
 */
function extractExamples(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const examples = {};

  // Match examples marked with <!-- example:name --> ... <!-- /example:name -->
  const exampleRegex = /\/\/ <!-- example:(\w+[-\w]*) -->([\s\S]*?)\/\/ <!-- \/example:\1 -->/g;

  const matches = [...content.matchAll(exampleRegex)];
  for (const match of matches) {
    const [, name, code] = match;

    // Clean up the code: remove leading/trailing whitespace from each line
    // but preserve relative indentation
    const lines = code.split("\n");

    // Remove empty lines at start and end
    while (lines.length > 0 && lines[0].trim() === "") {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    // Find minimum indentation (excluding empty lines)
    const minIndent = lines
      .filter((line) => line.trim() !== "")
      .reduce((min, line) => {
        const indent = line.match(/^(\s*)/)[1].length;
        return Math.min(min, indent);
      }, Number.POSITIVE_INFINITY);

    // Remove the minimum indentation from all lines
    let cleanedCode = lines.map((line) => (line.trim() === "" ? "" : line.slice(minIndent))).join("\n");

    // Convert dynamic imports to static imports for better readability in docs
    cleanedCode = convertDynamicImportsToStatic(cleanedCode);

    examples[name] = cleanedCode;
  }

  return examples;
}

/**
 * Get all example test files
 */
function getAllExampleFiles() {
  const files = fs.readdirSync(EXAMPLES_DIR);
  return files.filter((file) => file.endsWith(".test.ts")).map((file) => path.join(EXAMPLES_DIR, file));
}

/**
 * Extract all examples from all test files
 */
function extractAllExamples() {
  const allExamples = {};
  const files = getAllExampleFiles();

  for (const file of files) {
    const examples = extractExamples(file);
    Object.assign(allExamples, examples);
  }

  return allExamples;
}

/**
 * Update README with extracted examples
 */
function updateReadme(examples) {
  let readme = fs.readFileSync(README_PATH, "utf-8");

  // Replace example placeholders with actual code
  // Format: <!-- example-code:name -->...<!-- /example-code:name -->
  for (const [name, code] of Object.entries(examples)) {
    const placeholder = `<!-- example-code:${name} -->`;
    const endPlaceholder = `<!-- /example-code:${name} -->`;

    const placeholderRegex = new RegExp(
      `${placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${endPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "g",
    );

    const replacement = `${placeholder}\n\`\`\`typescript\n${code}\n\`\`\`\n${endPlaceholder}`;

    if (readme.includes(placeholder)) {
      readme = readme.replace(placeholderRegex, replacement);
    }
  }

  fs.writeFileSync(README_PATH, readme);
}

// Main execution
console.log("Extracting examples from test files...");
const examples = extractAllExamples();
console.log(`Found ${Object.keys(examples).length} examples`);

console.log("Updating README.md...");
updateReadme(examples);
console.log("README.md updated successfully!");

// Print summary
console.log("\nExtracted examples:");
for (const name of Object.keys(examples)) {
  console.log(`  - ${name}`);
}
