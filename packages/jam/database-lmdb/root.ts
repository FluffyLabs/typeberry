import * as fs from "node:fs";
import * as lmdb from "lmdb";

export type SubDb = lmdb.Database<Uint8Array, lmdb.Key>;

export type LmdbRootOptions = {
  readOnly?: boolean;
  ephemeral?: boolean;
  compression?: boolean;
};

/** A thin abstraction over lmdb database interface. */
export class LmdbRoot {
  readonly db: lmdb.RootDatabase<Uint8Array, lmdb.Key>;
  /** Path of the underlying LMDB data file, used to report on-disk usage. */
  private readonly dataFilePath: string;

  static new(dbPath: string, options: LmdbRootOptions) {
    return new LmdbRoot(dbPath, options);
  }

  private constructor(dbPath: string, { readOnly, ephemeral, compression }: LmdbRootOptions) {
    // `lmdb.open` treats an extension-less path as a directory and stores the
    // environment in `<dbPath>/data.mdb` (next to `lock.mdb`).
    this.dataFilePath = `${dbPath}/data.mdb`;

    const isEphemeral = ephemeral ?? false;

    this.db = lmdb.open(dbPath, {
      // experimental options
      noMemInit: true,
      remapChunks: true,
      eventTurnBatching: false,
      // For ephemeral databases (e.g. the fuzz target, which wipes on every reset)
      // durability is pointless, so we skip fsync and skip compressing the large
      // per-block leaf blobs. Both are pure overhead there and dominate the cost.
      // This trades disk space (uncompressed) and crash-durability for speed.
      compression: compression ?? !isEphemeral,
      noSync: isEphemeral,
      keyEncoding: "binary",
      encoding: "binary",
      readOnly,
    });
  }

  /** Open a sub-database under the same path. */
  subDb(name: string): SubDb {
    return this.db.openDB({ name });
  }

  /**
   * Apparent on-disk size of the LMDB data file, in bytes.
   *
   * Returns `null` if the file cannot be `stat`-ed (e.g. not yet created).
   */
  sizeInBytes(): number | null {
    try {
      return fs.statSync(this.dataFilePath).size;
    } catch {
      return null;
    }
  }

  /** Close the database and all sub-databases. */
  async close() {
    await this.db.close();
  }
}
