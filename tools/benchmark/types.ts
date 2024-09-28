export type Result = {
  current: BennyResults;
  diff: ComparisonResult;
};

export type ErrorResult = {
  name: string;
  err: string;
};
export type OkResult = {
  ok: true;
  name: string;
  ops: [number, number];
  margin: [number, number];
};

export type ComparisonResult = (ErrorResult | OkResult)[];

export type BennyOps = {
  name: string;
  ops: number;
  margin: number;
  percentSlower: number;
};

export type BennyResults = {
  name: string;
  date: string;
  version: string | null;
  results: BennyOps[] | null;
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
