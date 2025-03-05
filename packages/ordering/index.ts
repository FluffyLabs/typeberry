/** A return value of some comparator. */
enum OrderingValue {
  /** `self < other` */
  Less = -1,
  /** `self === other` */
  Equal = 0,
  /** `self > other` */
  Greater = 1,
}

class Ordering {
  constructor(public readonly value: OrderingValue) {}

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
 * e.g. `self < other => LESS`, `self > other => GREATER`
 */
export type Comparator<V> = (self: V, other: V) => Ordering;

export const LESS = new Ordering(OrderingValue.Less);
export const GREATER = new Ordering(OrderingValue.Greater);
export const EQUAL = new Ordering(OrderingValue.Equal);
