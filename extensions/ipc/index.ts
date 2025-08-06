import { EventEmitter } from "node:events";
import { type HeaderHash, type HeaderView, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, TRUNCATED_HASH_SIZE, type WithHash, blake2b } from "@typeberry/hash";
import { ce129, up0 } from "@typeberry/jamnp-s";
import type { Listener } from "@typeberry/state-machine";
import { startJamnpIpcServer } from "./jamnp/server.js";

export interface ExtensionApi {
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>;
}

export function startExtension(api: ExtensionApi) {
  const closeJamnpIpc = startJamnpExtension(api);
  return () => {
    closeJamnpIpc();
  };
}

function startJamnpExtension(api: ExtensionApi) {
  const announcements = new EventEmitter();
  let bestBlock: up0.HashAndSlot | null = null;

  api.bestHeader.on((headerWithHash) => {
    const header = headerWithHash.data.materialize();
    const hash = headerWithHash.hash;
    const final = up0.HashAndSlot.create({ hash, slot: header.timeSlotIndex });
    bestBlock = final;
    announcements.emit("announcement", up0.Announcement.create({ header, final }));
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

  return startJamnpIpcServer(announcements, getHandshake, getBoundaryNodes, getKeyValuePairs);
}
