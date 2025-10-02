import { check } from "@typeberry/utils";

export class ArrayView<T> implements Iterable<T> {
  private constructor(
    private readonly source: readonly T[],
    private readonly start: number,
    private readonly end: number,
  ) {}

  static from<T>(source: T[], start = 0, end = source.length): ArrayView<T> {
    check`
      ${start >= 0 && end <= source.length && start <= end} 
      Invalid start (${start})/end (${end}) for ArrayView 
    `;
    return new ArrayView(source, start, end);
  }

  get length(): number {
    return this.end - this.start;
  }

  get(i: number): T {
    check`
      ${i >= 0 && i < this.length}
      Index out of bounds: ${i} < ${this.length}
    `;
    return this.source[this.start + i];
  }

  subview(from: number, to: number = this.length): ArrayView<T> {
    return ArrayView.from(this.source, this.start + from, this.start + to);
  }

  toArray(): T[] {
    return this.source.slice(this.start, this.end);
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let i = this.start; i < this.end; i++) {
      yield this.source[i];
    }
  }
}
