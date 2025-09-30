import {
  type BlockView,
  type Header,
  type HeaderHash,
  type HeaderView,
  type StateRootHash,
  type TimeSlot,
  tryAsTimeSlot,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { v1 } from "@typeberry/fuzz-proto";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";
import { ce129, up0 } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import { tryAsU32 } from "@typeberry/numbers";
import { Listener } from "@typeberry/state-machine";
import { StateEntries } from "@typeberry/state-merkleization";
import { assertNever, Result } from "@typeberry/utils";
import { startJamnpIpcServer } from "./jamnp/server.js";
import { startIpcServer } from "./server.js";

export interface ExtensionApi {
  chainSpec: ChainSpec;
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>;
}

export function startExtension(api: ExtensionApi) {
  return startJamnpExtension(api);
}

export enum FuzzVersion {
  V1 = 1,
}

export interface FuzzTargetApi {
  nodeName: string;
  nodeVersion: v1.Version;
  gpVersion: v1.Version;
  chainSpec: ChainSpec;
  importBlock: (block: BlockView) => Promise<Result<StateRootHash, string>>;
  resetState: (header: Header, state: StateEntries, ancestry: [HeaderHash, TimeSlot][]) => Promise<StateRootHash>;
  getPostSerializedState: (hash: HeaderHash) => Promise<StateEntries | null>;
  getBestStateRootHash(): Promise<StateRootHash>;
}

export function startFuzzTarget(version: FuzzVersion, socket: string | null, api: FuzzTargetApi) {
  const socketName = socket ?? "jam_target.sock";

  if (version === FuzzVersion.V1) {
    return startIpcServer(socketName, (sender) => new v1.FuzzTarget(new FuzzHandler(api), sender, api.chainSpec));
  }

  assertNever(version);
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
    return [new ce129.KeyValuePair(startKey, value)];
  };

  return startJamnpIpcServer(api.chainSpec, announcements, getHandshake, getBoundaryNodes, getKeyValuePairs);
}

const logger = Logger.new(import.meta.filename, "ext-ipc");

class FuzzHandler implements v1.FuzzMessageHandler {
  constructor(public readonly api: FuzzTargetApi) {}

  async getSerializedState(value: HeaderHash): Promise<v1.KeyValue[]> {
    const state = await this.api.getPostSerializedState(value);
    if (state === null) {
      logger.warn`Fuzzer requested non-existing state for: ${value}`;
      return [];
    }

    return Array.from(state).map(([key, value]) => {
      return {
        key,
        value,
      };
    });
  }

  initialize(value: v1.Initialize): Promise<StateRootHash> {
    const { keyvals, header, ancestry } = value;
    const entries = StateEntries.fromEntriesUnsafe(keyvals.map(({ key, value }) => [key.asOpaque(), value]));
    const root = this.api.resetState(
      header,
      entries,
      ancestry.map((x) => [x.headerHash, x.slot]),
    );
    return root;
  }

  async importBlock(value: BlockView): Promise<Result<StateRootHash, v1.ErrorMessage>> {
    const res = await this.api.importBlock(value);
    if (res.isOk) {
      return res;
    }
    logger.log`Rejecting block with error: ${res.error}. ${res.details}`;
    return Result.error(v1.ErrorMessage.create({ message: res.error }));
  }

  async getPeerInfo(value: v1.PeerInfo): Promise<v1.PeerInfo> {
    logger.info`Fuzzer ${value} connected.`;

    return v1.PeerInfo.create({
      name: this.api.nodeName,
      appVersion: this.api.nodeVersion,
      jamVersion: this.api.gpVersion,
      fuzzVersion: value.fuzzVersion,
      // Safe to convert: Features are small enum values that fit in U32 range
      features: tryAsU32(v1.Features.Ancestry | v1.Features.Fork),
    });
  }
}
