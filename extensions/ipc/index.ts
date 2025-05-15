import { EventEmitter } from "node:events";
import { type HeaderHash, type HeaderView, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, type WithHash, blake2b } from "@typeberry/hash";
import type { Listener } from "@typeberry/state-machine";
import { KEY_SIZE, KeyValuePair } from "./protocol/ce-129-state-request";
import { Announcement, Handshake, HashAndSlot } from "./protocol/up-0-block-announcement";
import { startIpcServer } from "./server";

export interface ExtensionApi {
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>;
}

export function startExtension(api: ExtensionApi) {
  const announcements = new EventEmitter();
  let bestBlock = null as HashAndSlot | null;

  api.bestHeader.on((headerWithHash) => {
    const header = headerWithHash.data.materialize();
    const hash = headerWithHash.hash;
    const final = HashAndSlot.create({ hash, slot: header.timeSlotIndex });
    bestBlock = final;
    announcements.emit("announcement", Announcement.create({ header, final }));
  });

  // TODO [ToDr] `Handshake` should not leak that far.
  const getHandshake = () => {
    const final =
      bestBlock ?? HashAndSlot.create({ hash: Bytes.zero(HASH_SIZE).asOpaque<HeaderHash>(), slot: tryAsTimeSlot(0) });
    return Handshake.create({ final, leafs: [] });
  };

  const getBoundaryNodes = () => {
    return [];
  };

  const getKeyValuePairs = (_hash: HeaderHash, startKey: Bytes<KEY_SIZE>) => {
    let value = BytesBlob.blobFromNumbers([255, 255, 0, 0]);
    if (
      Bytes.fromBlob(
        blake2b.hashString("0x83bd3bde264a79a2e67c487696c1d7f0b549da89").raw.subarray(0, KEY_SIZE),
        KEY_SIZE,
      ).isEqualTo(startKey)
    ) {
      value = BytesBlob.blobFromNumbers([255, 255, 255, 0]);
    }
    return [new KeyValuePair(startKey, value)];
  };

  return startIpcServer(announcements, getHandshake, getBoundaryNodes, getKeyValuePairs);
}
