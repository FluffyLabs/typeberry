import {
  type Block,
  type Header,
  type HeaderHash,
  type HeaderView,
  type StateRootHash,
  tryAsTimeSlot,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE, TRUNCATED_HASH_SIZE, type WithHash, blake2b } from "@typeberry/hash";
import { ce129, up0 } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import { Listener } from "@typeberry/state-machine";
import { StateEntries } from "@typeberry/state-merkleization";
import type { Result } from "@typeberry/utils";
import { type FuzzMessageHandler, FuzzTarget } from "./fuzz/handler.js";
import { type KeyValue, PeerInfo, type SetState, type Version } from "./fuzz/types.js";
import { startJamnpIpcServer } from "./jamnp/server.js";
import { startIpcServer } from "./server.js";

export { Version } from "./fuzz/types.js";

export interface ExtensionApi {
  chainSpec: ChainSpec;
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>;
}

export function startExtension(api: ExtensionApi) {
  return startJamnpExtension(api);
}

export enum BlockImportError {
  NodeNotRunning = 0,
  BlockRejected = 1,
}

export interface FuzzTargetApi {
  nodeName: string;
  nodeVersion: Version;
  gpVersion: Version;
  chainSpec: ChainSpec;
  importBlock: (block: Block) => Promise<Result<StateRootHash, BlockImportError>>;
  resetState: (header: Header, state: StateEntries) => Promise<StateRootHash>;
  // TODO [ToDr] key/val instead of state entries?
  getPostSerializedState: (hash: HeaderHash) => Promise<StateEntries | null>;
}

export function startFuzzTarget(api: FuzzTargetApi) {
  return startIpcServer("jam_target.sock", (sender) => new FuzzTarget(new FuzzHandler(api), sender, api.chainSpec));
}

function startJamnpExtension(api: ExtensionApi) {
  const announcements = new Listener<up0.Announcement>();
  let bestBlock: up0.HashAndSlot | null = null;

  api.bestHeader.on((headerWithHash) => {
    const header = headerWithHash.data.materialize();
    const hash = headerWithHash.hash;
    const final = up0.HashAndSlot.create({ hash, slot: header.timeSlotIndex });
    bestBlock = final;
    announcements.emit(up0.Announcement.create({ header, final }));
  });

  const getHandshake = () => {
    const final =
      bestBlock ?? up0.HashAndSlot.create({ hash: Bytes.zero(HASH_SIZE).asOpaque(), slot: tryAsTimeSlot(0) });
    return up0.Handshake.create({ final, leafs: [] });
  };

  const getBoundaryNodes = () => {
    return [];
  };

  const getKeyValuePairs = (_hash: HeaderHash, startKey: ce129.Key) => {
    let value = BytesBlob.blobFromNumbers([255, 255, 0, 0]);
    if (
      Bytes.fromBlob(
        blake2b.hashString("0x83bd3bde264a79a2e67c487696c1d7f0b549da89").raw.subarray(0, TRUNCATED_HASH_SIZE),
        TRUNCATED_HASH_SIZE,
      ).isEqualTo(startKey)
    ) {
      value = BytesBlob.blobFromNumbers([255, 255, 255, 0]);
    }
    return [new ce129.KeyValuePair(startKey, value)];
  };

  return startJamnpIpcServer(api.chainSpec, announcements, getHandshake, getBoundaryNodes, getKeyValuePairs);
}

const logger = Logger.new(import.meta.filename, "ext-ipc");

class FuzzHandler implements FuzzMessageHandler {
  constructor(public readonly api: FuzzTargetApi) {}

  async getSerializedState(value: HeaderHash): Promise<KeyValue[]> {
    const state = await this.api.getPostSerializedState(value);
    if (state === null) {
      logger.warn(`Fuzzer requested non-existing state for: ${value}`);
      return [];
    }

    return Array.from(state).map(([key, value]) => {
      return {
        key: Bytes.fromBlob(key.raw.subarray(0, TRUNCATED_HASH_SIZE), TRUNCATED_HASH_SIZE),
        value,
      };
    });
  }

  async resetState(value: SetState): Promise<StateRootHash> {
    const entries = StateEntries.fromEntriesUnsafe(value.state.map(({ key, value }) => [key.asOpaque(), value]));
    const root = this.api.resetState(value.header, entries);
    return root;
  }

  async importBlock(value: Block): Promise<StateRootHash> {
    const res = await this.api.importBlock(value);
    if (res.isError) {
      logger.warn(`Fuzzer imported incorrect block with error ${res.error}. ${res.details}`);
      return Bytes.zero(HASH_SIZE).asOpaque();
    }

    return res.ok;
  }

  async getPeerInfo(value: PeerInfo): Promise<PeerInfo> {
    logger.info(`Fuzzer ${value} connected.`);

    return PeerInfo.create({
      name: this.api.nodeName,
      appVersion: this.api.nodeVersion,
      jamVersion: this.api.gpVersion,
    });
  }
}
