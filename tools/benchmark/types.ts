export type Result = {
  current: BennyResults;
  diff: ComparisonResult;
};

export type ErrorResult = {
  err: string;
};
export type OkResult = {
  ok: true;
  ops: [number, number];
  margin: [number, number];
};

export type ComparisonResult = (ErrorResult | OkResult)[];

export type BennyResults = {
  name: string;
  date: string;
  version: string | null;
  results:
    | {
        name: string;
        ops: number;
        margin: number;
        percentSlower: number;
      }[]
    | null;
  fastest:
    | {
        name: string;
        index: number;
      }
    | {
        name: string;
        index: number;
      }[];
  slowest: {
    name: string;
    index: number;
  };
};
