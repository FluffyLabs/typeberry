import type { ComparisonResult } from './types';

type ErrorSummary = {
  name: string,
  err: string,
};

export function formatResults(input: Map<String, ComparisonResult>) {
  let okCount = 0;
  let allCount = 0;
  let errors: ErrorSummary[] = [];

  for (const [name, diffs] of input.entries()) {
    for (const [idx, diff] of diffs.entries()) {
      allCount += 1;
      if ('err' in diff && diff.err) {
        errors.push({
          name: `${name}[${idx}]`,
          err: diff.err,
        });
      } else {
        okCount += 1;
      }
    }
  }


  const errorsTxt = formatErrors(errors);
  return `
    Benchmarks summary: ${okCount}/${allCount} OK

    ${errorsTxt}
`;
}

function formatErrors(errors: ErrorSummary[]) {
  if (errors.length === 0) {
    return '';
  }

  return `
| Benchmark | Error |
|-----------|-------|
${errors.map(e => `| ${e.name} | ${e.err} |`).join('\n')}
`;
}
