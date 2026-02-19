/**
 * Page access flags. Using const enum for zero-cost abstraction.
 * Bit 1 = readable, Bit 2 = writable.
 */
export enum PageAccess {
  READ = 1,
  READ_WRITE = 3,
}

/**
 * A single memory page (4KB).
 *
 * One class instead of hierarchy = monomorphic hidden class in V8.
 * No vtable dispatch.
 *
 * - ReadablePage: data = subarray of program data (zero-copy), access = READ
 * - WriteablePage: data = Uint8Array from BufferPool, access = READ_WRITE
 */
export class Page {
  constructor(
    public readonly data: Uint8Array,
    public readonly access: PageAccess,
  ) {}
}
