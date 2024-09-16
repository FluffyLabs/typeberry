import { BENCHMARKS_DIR } from "./setup";
import type { Result } from "./types";

type ErrorSummary = {
  name: string;
  filePath: string;
  err: string;
};

type BenchmarkSummary = {
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
      const fullName = `${name}[${idx}] → ${diff.name}`;
      const filePath = commitHash ? `../blob/${commitHash}/${BENCHMARKS_DIR}/${name}` : `./${BENCHMARKS_DIR}/${name}`;
      const curr = diffs.current.results?.[idx];

      if (curr) {
        all.push({
          name: fullName,
          filePath,
          ops: `${curr.ops} ±${curr.margin}%`,
          comment: curr.percentSlower === 0 ? "fastest ✅" : `${curr.percentSlower}% slower`,
        });
      }

      if ("err" in diff && diff.err) {
        errors.push({
          name: fullName,
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
### Benchmarks summary: ${okCount}/${all.length} OK ${okCount === all.length ? "✅" : "❌"}

${detailsTxt}

${errorsTxt}
`;
}

function formatDetails(all: BenchmarkSummary[]) {
  return `
<details>
<summary>View all</summary>

| Benchmark | Ops |  |
|-----------|-----|--|
${all.map((b) => `| [${b.name}](${b.filePath}) | ${b.ops} | ${b.comment} |`).join("\n")}
</details>
`;
}

function formatErrors(errors: ErrorSummary[]) {
  if (errors.length === 0) {
    return "";
  }

  return `
| Benchmark | Error |
|-----------|-------|
${errors.map((e) => `| [${e.name}](${e.filePath}) | ${e.err} |`).join("\n")}
`;
}
