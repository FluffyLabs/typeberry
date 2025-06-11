import { BENCHMARKS_DIR } from "./setup.js";
import type { Result } from "./types.js";

type ErrorSummary = {
  file: string;
  name: string;
  filePath: string;
  err: string;
};

type BenchmarkSummary = {
  file: string;
  name: string;
  filePath: string;
  ops: string;
  comment: string;
};

export function formatResults(input: Map<string, Result>, commitHash?: string) {
  let okCount = 0;
  const all: BenchmarkSummary[] = [];
  const errors: ErrorSummary[] = [];

  for (const [name, diffs] of input.entries()) {
    for (const [idx, diff] of diffs.diff.entries()) {
      const filePath =
        commitHash !== undefined ? `../blob/${commitHash}/${BENCHMARKS_DIR}/${name}` : `./${BENCHMARKS_DIR}/${name}`;
      const curr = diffs.current.results?.[idx];
      const file = `${name}[${idx}]`;
      if (curr !== undefined) {
        all.push({
          name: diff.name,
          file,
          filePath,
          ops: `${curr.ops} ±${curr.margin}%`,
          comment: curr.percentSlower === 0 ? "fastest ✅" : `${curr.percentSlower}% slower`,
        });
      }

      if ("err" in diff && diff.err !== undefined) {
        errors.push({
          name: diff.name,
          file,
          filePath,
          err: diff.err,
        });
      } else {
        okCount += 1;
      }
    }
  }

  const detailsTxt = formatDetails(all);
  const errorsTxt = formatErrors(errors);
  return `
${errorsTxt}

${detailsTxt}

### Benchmarks summary: ${okCount}/${all.length} OK ${okCount === all.length ? "✅" : "❌"}
`;
}

function formatDetails(all: BenchmarkSummary[]) {
  return `
<details>
<summary>View all</summary>

| File | Benchmark | Ops |  |
|------|-----------|-----|--|
${all.map((b) => `| [${b.file}](${b.filePath}) | ${b.name} | ${b.ops} | ${b.comment} |`).join("\n")}
</details>
`;
}

function formatErrors(errors: ErrorSummary[]) {
  if (errors.length === 0) {
    return "";
  }

  return `
| File | Benchmark | Error |
|------|-----------|-------|
${errors.map((e) => `| [${e.file}](${e.filePath}) | ${e.name} |  ${e.err} |`).join("\n")}
`;
}
