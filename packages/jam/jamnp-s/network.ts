import type { BlockView, HeaderHash } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import type { ed25519 } from "@typeberry/crypto";
import type { BlocksDb } from "@typeberry/database";
import { Logger } from "@typeberry/logger";
import { Quic } from "@typeberry/networking";
import { OK } from "@typeberry/utils";
import { type Bootnode, Connections } from "./peers.js";
import { StreamManager } from "./stream-manager.js";
import { SyncTask } from "./tasks/sync.js";
import { handleAsyncErrors } from "./utils.js";

const logger = Logger.new(import.meta.filename, "jamnps");

export async function setup(
  bind: { host: string; port: number },
  genesisHash: HeaderHash,
  key: ed25519.Ed25519Pair,
  bootnodes: Bootnode[],
  spec: ChainSpec,
  blocks: BlocksDb,
  onNewBlocks: (blocks: BlockView[]) => void,
) {
  const genesisFirstBytes = genesisHash.toString().substring(2, 10);
  const network = await Quic.setup({
    host: bind.host,
    port: bind.port,
    key,
    protocols: [`jamnp-s/0/${genesisFirstBytes}`],
  });

  const connections = new Connections(network);
  connections.addPersistentRetry(bootnodes);

  const streamManager = new StreamManager();

  // start the networking tasks
  const syncTask = SyncTask.start(spec, streamManager, connections, blocks, onNewBlocks);

  network.onPeerConnect((peer) => {
    console.log(`Running on peer connected with ${peer.id}`);
    // open UP0 stream with each new peer after the connection is fully estabilished.
    setImmediate(() => {
      syncTask.openUp0(peer);
    });

    // whenever the peer wants to open a stream with us, let's handle that.
    peer.addOnIncomingStream((stream) => {
      handleAsyncErrors(
        () => streamManager.onIncomingStream(peer, stream),
        (e) => {
          logger.error(`[${peer.id}:${stream.streamId}]🚰  Stream error: ${e}. Disconnecting peer.`);
          peer.disconnect();
        },
      );
      return OK;
    });
    return OK;
  });

  return {
    network,
    streamManager,
  };
}
