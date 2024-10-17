import { EventEmitter} from 'node:events';
import {startIpcServer} from "./server";
import {Announcement} from './protocol/up-0-block-announcement';
import {Listener} from '@typeberry/state-machine';
import {Header, HeaderHash, WithHash} from '@typeberry/block';

export interface ExtensionApi {
  bestHeader: Listener<WithHash<HeaderHash, Header>>;
}

export function startExtension(api: ExtensionApi) {
  const announcements = new EventEmitter;
  announcements.emit('annoucement', new Announcement(header, final))
  startIpcServer(announcements)
}
