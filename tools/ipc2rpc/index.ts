import * as path from 'node:path';
import * as os from 'node:os';
import {startClient} from './client';
import * as up0 from '@typeberry/ext-ipc/protocol/up-0-block-announcement';
import {HASH_SIZE, HeaderHash, TimeSlot} from '@typeberry/block';
import {Bytes} from '@typeberry/bytes';

main();

async function main() {
  const isWindows = os.platform() === 'win32';
  const socketPath = isWindows
    ? '\\\\.\\pipe\\typeberry'
    : path.join(os.tmpdir(), 'typeberry.ipc');

  const client = await startClient(socketPath);
  console.info('Opening new UP0 stream.');
  client.withNewStream(up0.STREAM_KIND, (handler: up0.Handler, sender) => {
    const final = new up0.HashAndSlot(Bytes.zero(HASH_SIZE) as HeaderHash, 0 as TimeSlot);
    console.info('Sending handshake.');
    handler.sendHandshake(sender, new up0.Handshake(final, []))
  });
}
