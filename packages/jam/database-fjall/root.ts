import * as fs from "node:fs";
import * as path from "node:path";
import { type Keyspace, open, type Partition } from "@fjall-js/fjall";

export type { Partition };

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
  /**
   * When set, durability flushes (`persist`) are skipped entirely.
   *
   * Only safe for throwaway databases (e.g. the fuzz target, which wipes on
   * every reset). Mirrors LMDB's `noSync`.
   */
  ephemeral?: boolean;
};

/**
 * A thin abstraction over the fjall keyspace.
 *
 * Unlike LMDB (a memory-mapped B-tree), fjall is an LSM-tree that reads/writes
 * through regular file I/O, so its working set is bounded by an explicit block
 * cache rather than the whole mmap. LMDB has been causing oom issues because
 * of that.
 */
export class FjallRoot {
  private constructor(
    private readonly keyspace: Keyspace,
    /** Path of the underlying keyspace directory, used to report on-disk usage. */
    private readonly dbPath: string,
    private readonly options: FjallRootOptions,
  ) {}

  /** Open (or create) a fjall keyspace at the given path. */
  static async open(dbPath: string, options: FjallRootOptions): Promise<FjallRoot> {
    const keyspace = await open(dbPath);
    return new FjallRoot(keyspace, dbPath, options);
  }

  /** Open (or create) a partition under this keyspace. */
  async partition(name: string): Promise<Partition> {
    return this.keyspace.partition(name);
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
    await this.keyspace.persist();
  }

  /**
   * Apparent on-disk size of the keyspace directory, in bytes.
   *
   * Returns `null` if the directory cannot be walked (e.g. not yet created).
   * Unlike LMDB's single `data.mdb`, a fjall keyspace is a directory of
   * partition and journal files, so we sum it recursively.
   */
  sizeInBytes(): number | null {
    try {
      return dirSizeInBytes(this.dbPath);
    } catch {
      return null;
    }
  }

  /** Persist with `sync-all` and release the keyspace handle. */
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
