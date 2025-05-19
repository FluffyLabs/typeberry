import { setTimeout } from "node:timers/promises";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ed25519 } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import { socket } from "../";

const logger = Logger.new(__filename, "net:demo");

async function main(connectTo: number, serverPort: number) {
  const genesisHash = "0259fbe9"; // polkajam: 0259fbe9
  const clientKey = await ed25519.privateKey(Bytes.fill(ed25519.ED25519_PRIV_KEY_BYTES, 1));
  const serverKey = await ed25519.privateKey(Bytes.fill(ed25519.ED25519_PRIV_KEY_BYTES, 2));

  const network = await socket.setup({
    host: "127.0.0.1",
    port: serverPort,
    key: connectTo === 0 ? serverKey : clientKey,
    protocols: [`jamnp-s/0/${genesisHash}`],
  });

  network.onPeerConnect((p) => {
    logger.log(`New peer: ${p.id}`);
    p.addOnStreamOpen(async (stream) => {
      logger.info(`🚰  Stream with ${p.id} opened`);
      const {readable } = stream;
      const reader = readable.getReader();
      const data = await reader.read();
      if (data.value) {
        const bytes = BytesBlob.blobFrom(data.value);
        logger.info(`🚰 Peer ${p.id} stream data: ${bytes}`);
      }
      if (data.done) {
        logger.info(`🚰 Peer ${p.id} stream done.`);
        return;
      }
    });
  });

  await network.start();

  if (connectTo === 0) {
    logger.warn("No client port given. Finishing.");
    return;
  }

  for (;;) {
    await setTimeout(1000);
    try {
      const peer = await network.dial({
        host: "127.0.0.1",
        port: connectTo,
      });
      // open a bunch of streams
      for (let i = 0; i < 10; i++) {
        const { writable } = peer.openStream();
        // After opening a stream, the stream initiator must send a single byte identifying the stream kind.
        writable.getWriter().write(Uint8Array.from([i]))
      }
      break;
    } catch (e) {
      logger.warn(`Dial error: ${e}`);
    }
  }
  logger.log("Connected...");
}

const args = process.argv.slice(2);
const parsePort = (v: string | undefined) => {
  if (!v) {
    return 0;
  }

  const p = Number.parseInt(v);
  if (Number.isNaN(p)) {
    throw new Error(`Not a number: ${v}`);
  }
  return p;
};

main(parsePort(args[0]), parsePort(args[1]));
