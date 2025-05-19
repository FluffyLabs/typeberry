import { setTimeout } from "node:timers/promises";
import { Bytes } from "@typeberry/bytes";
import { ed25519 } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import { socket } from "../";

const logger = Logger.new(__filename, "net:demo");

async function main(connectTo: number, serverPort: number) {
  const genesisHash = "deadbeef";
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
    p.addOnStreamOpen((_stream) => {
      logger.info(`🚰 Peer ${p.id} opened a stream`);
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
        // writable.
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
