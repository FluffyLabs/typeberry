import { setTimeout } from "node:timers/promises";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ed25519 } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import { OK } from "@typeberry/utils";
import { Quic } from "../index.js";

const logger = Logger.new(import.meta.filename, "net:demo");

async function main(clientPort: number, serverPort: number) {
  const genesisHash = "0259fbe9"; // polkajam: 0259fbe9
  const clientKey = await ed25519.privateKey(Bytes.fill(ed25519.ED25519_PRIV_KEY_BYTES, 1));
  const serverKey = await ed25519.privateKey(Bytes.fill(ed25519.ED25519_PRIV_KEY_BYTES, 2));

  const network = await Quic.setup({
    host: "127.0.0.1",
    port: serverPort,
    key: clientPort === 0 ? serverKey : clientKey,
    protocols: [`jamnp-s/0/${genesisHash}`],
  });

  network.peers.onPeerConnected((peer) => {
    logger.log(`New peer: ${peer.id}`);
    peer.addOnIncomingStream((stream) => {
      (async () => {
        logger.info(`🚰  Stream with ${peer.id} opened`);
        const { readable } = stream;
        const reader = readable.getReader();
        for (;;) {
          const data = await reader.read();
          if (data.value !== undefined) {
            const bytes = BytesBlob.blobFrom(data.value);
            logger.info(`🚰 Peer ${peer.id} stream data: ${bytes}`);
          }
          if (data.done) {
            logger.info(`🚰 Peer ${peer.id} stream done.`);
            return;
          }
        }
      })().catch((e) => {
        logger.error(`Error handling stream: ${e}. Disconnecting.`);
        peer.disconnect();
      });

      return OK;
    });
    return OK;
  });

  await network.start();

  if (clientPort === 0) {
    logger.warn("No client port given. Finishing.");
    return;
  }

  for (;;) {
    await setTimeout(1000);
    try {
      const peer = await network.dial({
        host: "127.0.0.1",
        port: clientPort,
      });
      logger.log("Connected, opening streams...");
      await setTimeout(2000);
      // open a bunch of streams
      for (let i = 0; i < 10; i++) {
        const stream = peer.openStream();
        // After opening a stream, the stream initiator must send a single byte identifying the stream kind.
        await stream.writable.getWriter().write(Uint8Array.from([i]));
      }
      logger.log("Streams done. Disconnecting.");
      await peer.disconnect();
      break;
    } catch (e) {
      logger.warn(`Dial error: ${e}`);
    }
  }

  logger.log("Closing networking...");
  await network.stop();
}

const args = process.argv.slice(2);
const parsePort = (v: string | undefined) => {
  if (v === undefined) {
    return 0;
  }

  const p = Number.parseInt(v);
  if (Number.isNaN(p)) {
    throw new Error(`Not a number: ${v}`);
  }
  return p;
};

main(parsePort(args[0]), parsePort(args[1])).catch((e) => {
  logger.error(e);
  process.exit(-1);
});
