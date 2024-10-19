import { EventEmitter } from "node:events";
import { HASH_SIZE, type Header, type HeaderHash, type TimeSlot, type WithHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { Listener } from "@typeberry/state-machine";
import { KeyValuePair } from "./protocol/ce-129-state-request";
import { Announcement, Handshake, HashAndSlot } from "./protocol/up-0-block-announcement";
import { startIpcServer } from "./server";

export interface ExtensionApi {
  bestHeader: Listener<WithHash<HeaderHash, Header>>;
}

export function startExtension(api: ExtensionApi) {
  const announcements = new EventEmitter();
  let bestBlock = null as HashAndSlot | null;

  api.bestHeader.on((headerWithHash) => {
    const header = headerWithHash.data;
    const hash = headerWithHash.hash;
    const final = new HashAndSlot(hash, header.timeSlotIndex);
    bestBlock = final;
    announcements.emit("announcement", new Announcement(header, final));
  });

  // TODO [ToDr] `Handshake` should not leak that far.
  const getHandshake = () => {
    const final = bestBlock ?? new HashAndSlot(Bytes.zero(HASH_SIZE) as HeaderHash, 0 as TimeSlot);
    return new Handshake(final, []);
  };

  const getBoundaryNodes = () => {
    return [];
  };

  const getKeyValuePairs = () => {
    return [new KeyValuePair(Bytes.fill(31, 5), BytesBlob.fromNumbers([255, 255, 255, 255]))];
  };

  const ipcServer = startIpcServer(announcements, getHandshake, getBoundaryNodes, getKeyValuePairs);

  return () => {
    // stop accepting new connections
    ipcServer.server.close();
    // abort the server
    ipcServer.close();
  };
}
