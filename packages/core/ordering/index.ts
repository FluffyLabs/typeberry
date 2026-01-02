/** A return value of some comparator. */
export enum OrderingValue {
  /** `self < other` */
  Less = -1,
  /** `self === other` */
  Equal = 0,
  /** `self > other` */
  Greater = 1,
}

/** A class that provides utility methods to check the type of ordering. */
export class Ordering {
  private constructor(public readonly value: OrderingValue) {}

  static Less = new Ordering(OrderingValue.Less);
  static Greater = new Ordering(OrderingValue.Greater);
  static Equal = new Ordering(OrderingValue.Equal);

  isLess() {
    return this.value === OrderingValue.Less;
  }

  isGreater() {
    return this.value === OrderingValue.Greater;
  }

  isEqual() {
    return this.value === OrderingValue.Equal;
  }

  isNotEqual() {
    return !this.isEqual();
  }

  isGreaterOrEqual() {
    return this.isEqual() || this.isGreater();
  }

  isLessOrEqual() {
    return this.isEqual() || this.isLess();
  }
}

/**
 * A type that compares the `self` value to `other` and returns an ordering in respect to `self`.
 *
 * e.g. `self < other => Ordering.Less`, `self > other => Ordering.Greater`
 */
export type Comparator<V> = (self: V, other: V) => Ordering;
