export type Result = {
  current: BennyResults,
  diff: ComparisonResult,
};

export type ComparisonResult = {
  err?: string;
  ok?: boolean;
  ops?: [number, number];
  margin?: [number, number];
}[];

export type BennyResults = {
  name: string;
  date: string;
  version: string | null;
  results: {
    name: string;
    ops: number;
    margin: number;
    percentSlower: number;
  }[];
  fastest: {
    name: string;
    index: number;
  };
  slowest: {
    name: string;
    index: number;
  };
};
