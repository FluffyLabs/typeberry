import * as lmdb from "lmdb";

export type SubDb = lmdb.Database<Uint8Array, lmdb.Key>;

/** A thin abstraction over lmdb database interface. */
export class LmdbRoot {
  readonly db: lmdb.RootDatabase<Uint8Array, lmdb.Key>;

  static new(dbPath: string, readOnly = false, ephemeral = false) {
    return new LmdbRoot(dbPath, readOnly, ephemeral);
  }

  private constructor(dbPath: string, readOnly = false, ephemeral = false) {
    this.db = lmdb.open(dbPath, {
      // experimental options
      mapSize: 256 * 1024 * 1024 * 1024, // 256G max db size
      useWritemap: true,
      pageSize: 8192,
      // For ephemeral databases (e.g. the fuzz target, which wipes on every reset)
      // durability is pointless, so we skip fsync and skip compressing the large
      // per-block leaf blobs. Both are pure overhead there and dominate the cost.
      // This trades disk space (uncompressed) and crash-durability for speed.
      compression: !ephemeral,
      noSync: ephemeral,
      keyEncoding: "binary",
      encoding: "binary",
      readOnly,
    });
  }

  /** Open a sub-database under the same path. */
  subDb(name: string): SubDb {
    return this.db.openDB({ name });
  }

  /** Close the database and all sub-databases. */
  async close() {
    await this.db.close();
  }
}
