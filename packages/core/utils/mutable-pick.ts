type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type MutablePick<T, K extends keyof T> = Mutable<Pick<T, K>>;
