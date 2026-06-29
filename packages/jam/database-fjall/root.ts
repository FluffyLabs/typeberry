import * as fs from "node:fs";
import * as path from "node:path";
import {
  type Keyspace,
  open,
  openReadonly,
  type Partition,
  type ReadonlyKeyspace,
  type ReadonlyPartition,
} from "@fjall-js/fjall";

const DEFAULT_CACHE_SIZE_BYTES = 64 * 1024 * 1024;

export type { Partition, ReadonlyPartition };
export type FjallPartition = Partition | ReadonlyPartition;

/**
 * Normalize a value read from fjall (a Node `Buffer`) into a plain `Uint8Array`.
 */
export function toUint8Array(value: Buffer | null): Uint8Array | null {
  if (value === null) {
    return null;
  }
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

export type FjallRootOptions = {
  /** Open a read-only wrapper surface over the shared keyspace. */
  readOnly?: boolean;
  /**
   * When set, we skip explicit durability flushes (`persist`).
   *
   * Only safe for throwaway databases, like the fuzz target that wipes on every
   * reset.
   */
  ephemeral?: boolean;
  /**
   * Cache size in bytes, shared by all partitions of the keyspace. fjall reads
   * through this cache, so it bounds how much we keep in memory. When not set,
   * typeberry uses a conservative default.
   */
  cacheSizeBytes?: number;
};

/**
 * Thin wrapper over the fjall keyspace.
 *
 * fjall is an LSM-tree: it reads and writes through normal file i/o and keeps
 * only a bounded block cache in memory, so the resident set stays bounded even
 * when the store on disk is big.
 */
export class FjallRoot {
  private constructor(
    private readonly keyspace: Keyspace | ReadonlyKeyspace,
    /** Path of the underlying keyspace directory, used to report on-disk usage. */
    private readonly dbPath: string,
    private readonly options: FjallRootOptions,
  ) {}

  /** Open (or create) a fjall keyspace at the given path. */
  static async open(dbPath: string, options: FjallRootOptions = {}): Promise<FjallRoot> {
    // fjall-js 0.3 shares one engine per path. Readers must use the read-only
    // wrapper surface; durability is driven explicitly through persist().
    const config = {
      path: dbPath,
      cacheSizeBytes: options.cacheSizeBytes ?? DEFAULT_CACHE_SIZE_BYTES,
    };
    const keyspace = options.readOnly === true ? await openReadonly(config) : await open(config);
    return new FjallRoot(keyspace, dbPath, options);
  }

  /** Whether this root was opened through fjall's read-only surface. */
  get readOnly(): boolean {
    return this.options.readOnly === true;
  }

  /** Open (or create) a partition under this keyspace. */
  async partition(name: string): Promise<FjallPartition> {
    return this.keyspace.partition(name);
  }

  /** Open a writable partition, failing early when this root is read-only. */
  async writablePartition(name: string): Promise<Partition> {
    if (this.readOnly) {
      throw new Error(`Cannot open writable fjall partition '${name}' from a read-only keyspace.`);
    }
    return (await this.keyspace.partition(name)) as Partition;
  }

  /**
   * Flush the journal to disk so prior writes survive a crash.
   *
   * Call after a logically-complete unit of work (one block, one state commit).
   * A no-op for ephemeral databases.
   */
  async persist(): Promise<void> {
    if (this.options.ephemeral === true) {
      return;
    }
    if (this.readOnly) {
      throw new Error("Cannot persist a read-only fjall keyspace.");
    }
    await (this.keyspace as Keyspace).persist();
  }

  /**
   * Size of the keyspace directory on disk, in bytes.
   *
   * Returns `null` when the directory cannot be walked (e.g. not created yet).
   * A fjall keyspace is a directory of partition and journal files, so we sum
   * them recursively.
   */
  sizeInBytes(): number | null {
    try {
      return dirSizeInBytes(this.dbPath);
    } catch {
      return null;
    }
  }

  /** Release this keyspace handle. Call persist() first when durability is needed. */
  async close(): Promise<void> {
    await this.keyspace.close();
  }
}

function dirSizeInBytes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeInBytes(full);
    } else if (entry.isFile()) {
      total += fs.statSync(full).size;
    }
  }
  return total;
}
