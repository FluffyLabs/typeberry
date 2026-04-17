import fs from "node:fs";

const distDir = `${import.meta.dirname}/../../dist`;
try {
  fs.mkdirSync(distDir);
} catch {
  // ignore
}

const suiteToRun = process.argv[2];
if (suiteToRun === undefined) {
  throw new Error("Provide 1 argument with a suite filename to run.");
}

const suitePath = `${import.meta.dirname}/${suiteToRun}`;
const outputFile = `${distDir}/${suiteToRun.replace(".ts", "")}.txt`;

// `--smol` forces more aggressive GC; without it the JS heap climbs to ~8 GB
// across 1000+ tests and hits `RangeError: Out of memory`. See investigation
// notes in jam-conformance-072-flaky-list.ts.
const proc = Bun.spawn(["bun", "--smol", "test", suitePath, "--timeout", "300000", ...process.argv.slice(3)], {
  cwd: import.meta.dirname,
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
  },
});

const exitCode = await proc.exited;

// Write a summary to the output file
const status = exitCode === 0 ? "OK" : "FAILED";
fs.writeFileSync(outputFile, `### ${suiteToRun} ${status}\n`);

process.exit(exitCode);
