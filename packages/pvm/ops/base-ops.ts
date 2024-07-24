import type { Context } from "../context";

export class BaseOps<T extends keyof Context> {
  constructor(protected context: Pick<Context, T>) {}
}
