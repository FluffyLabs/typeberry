import { EventEmitter} from 'node:events';
import {startIpcServer} from "./server";
import {Announcement, HashAndSlot} from './protocol/up-0-block-announcement';
import {Listener} from '@typeberry/state-machine';
import {Header, HeaderHash, WithHash} from '@typeberry/block';

export interface ExtensionApi {
  bestHeader: Listener<WithHash<HeaderHash, Header>>;
}

export function startExtension(api: ExtensionApi) {
  const announcements = new EventEmitter;

  api.bestHeader.on((headerWithHash) => {
    const header = headerWithHash.data;
    const hash = headerWithHash.hash;
    const final = new HashAndSlot(hash, header.timeSlotIndex);
    announcements.emit('annoucement', new Announcement(header, final))
  });

  const ipcServer = startIpcServer(announcements);

  return () => {
    // TODO [ToDr] that's probably not enough - we should also disconnect existing clients.
    ipcServer.close();
  };
}
