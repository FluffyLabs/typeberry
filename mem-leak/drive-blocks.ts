/**
 * Block-dump fuzz-target memory-leak driver.
 *
 * Unlike drive.ts (which loops a single isolated StateTransition), this streams
 * a concatenated dump of *consecutive* real blocks (e.g. davxy traces exported
 * with `@typeberry/convert ... to-bin`, then `cat`-ed together) through the
 * fuzz socket as a proper chain:
 *
 *    Initialize(genesis header + state from chain-spec.json)  ->  StateRoot
 *    ImportBlock(block[0]) ImportBlock(block[1]) ...           ->  StateRoot each
 *
 * Because the blocks form a valid chain from genesis, the target must run
 * WITHOUT --init-genesis-from-ancestry (real parent-hash + state-root checks).
 *
 * To amplify a leak we replay the whole sequence `--passes` times; each pass
 * starts with a fresh Initialize (which triggers resetState -> close + rebuild
 * on the target), so we stress the reset path and the multi-block import path.
 *
 * This is a throwaway debugging tool; it is NOT part of the committed tree.
 */
import * as fs from "node:fs";
import { Block, type BlockView, Header } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, EndOfDataError } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { v1 } from "@typeberry/fuzz-proto";
import { TRUNCATED_HASH_SIZE } from "@typeberry/hash";
import { expectStateRoot, FuzzClient, handshake } from "./fuzz-client.js";

type Args = {
  socket: string;
  blocks: string;
  chainspec: string;
  passes: number;
  spec: "auto" | "tiny" | "full";
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    socket: "/tmp/jam_target.sock",
    blocks: "../typeberry-testing/block-dumps/fallback.bin",
    chainspec: "../typeberry-testing/block-dumps/chain-spec.json",
    passes: 50,
    spec: "auto",
  };
  for (const arg of argv) {
    const [k, v] = arg.replace(/^--/, "").split("=");
    if (k === "socket" && v !== undefined) out.socket = v;
    else if (k === "blocks" && v !== undefined) out.blocks = v;
    else if (k === "chainspec" && v !== undefined) out.chainspec = v;
    else if (k === "passes" && v !== undefined) out.passes = Number(v);
    else if (k === "spec" && (v === "auto" || v === "tiny" || v === "full")) out.spec = v;
    else throw new Error(`Unrecognized argument: ${arg}`);
  }
  return out;
}

type ChainSpecJson = {
  genesis_header: string;
  genesis_state: Record<string, string>;
};

/** Build the Initialize genesis (header + state keyvals) from the chain-spec.json. */
function buildInitialize(chainSpecJson: ChainSpecJson, spec: ChainSpec): v1.Initialize {
  const headerBlob = BytesBlob.parseBlobNoPrefix(chainSpecJson.genesis_header);
  const header = Decoder.decodeObject(Header.Codec, headerBlob, spec);

  const keyvals = Object.entries(chainSpecJson.genesis_state).map(([key, value]) =>
    v1.KeyValue.create({
      key: Bytes.parseBytesNoPrefix(key, TRUNCATED_HASH_SIZE),
      value: BytesBlob.parseBlobNoPrefix(value),
    }),
  );

  // No ancestry: this is a real chain rooted at the provided genesis.
  return v1.Initialize.create({ header, keyvals, ancestry: [] });
}

/** Stream-decode every Block in a concatenated dump (mirrors node/reader.ts). */
function decodeBlocks(data: Uint8Array, spec: ChainSpec): BlockView[] {
  const decoder = Decoder.fromBlob(data, spec);
  const blocks: BlockView[] = [];
  try {
    while (true) {
      blocks.push(decoder.object(Block.Codec.View));
    }
  } catch (e) {
    if (!(e instanceof EndOfDataError)) {
      throw e;
    }
  }
  return blocks;
}

/** Load chain spec + blocks, auto-detecting tiny/full if not pinned. */
function load(args: Args): { init: v1.Initialize; blocks: BlockView[]; spec: ChainSpec } {
  const chainSpecJson: ChainSpecJson = JSON.parse(fs.readFileSync(args.chainspec, "utf-8"));
  const data = fs.readFileSync(args.blocks);

  const candidates: [string, ChainSpec][] =
    args.spec === "tiny"
      ? [["tiny", tinyChainSpec]]
      : args.spec === "full"
        ? [["full", fullChainSpec]]
        : [
            ["tiny", tinyChainSpec],
            ["full", fullChainSpec],
          ];

  let lastErr: unknown;
  for (const [name, spec] of candidates) {
    try {
      const init = buildInitialize(chainSpecJson, spec);
      const blocks = decodeBlocks(data, spec);
      if (blocks.length === 0) {
        throw new Error("no blocks decoded");
      }
      console.log(`[driver] loaded '${name}' spec: ${blocks.length} block(s), ${init.keyvals.length} genesis keyvals`);
      return { init, blocks, spec };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not load genesis + blocks with any known spec: ${lastErr}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { init, blocks, spec } = load(args);

  const initMsg: v1.Message = { type: v1.MessageType.Initialize, value: init };
  const importMsgs: v1.Message[] = blocks.map((block) => ({ type: v1.MessageType.ImportBlock, value: block }));
  const firstSlot = blocks[0].header.view().timeSlotIndex.materialize();
  const lastSlot = blocks[blocks.length - 1].header.view().timeSlotIndex.materialize();

  console.log(`[driver] connecting to ${args.socket}`);
  const client = await FuzzClient.connect(args.socket, spec);
  const peer = await handshake(client);
  console.log(`[driver] handshook with '${peer.name}' (fuzz v${peer.fuzzVersion})`);
  console.log(`[driver] block slots #${firstSlot}..#${lastSlot}, replaying ${args.passes} pass(es)`);

  const started = Date.now();
  let totalImports = 0;
  for (let p = 0; p < args.passes; p++) {
    expectStateRoot(await client.request(initMsg), `Initialize pass ${p}`);
    let lastRoot = "";
    for (let b = 0; b < importMsgs.length; b++) {
      const root = expectStateRoot(await client.request(importMsgs[b]), `ImportBlock pass ${p} block ${b}`);
      lastRoot = `${root}`;
      totalImports++;
    }
    if (p === 0 || (p + 1) % 10 === 0) {
      console.log(`[driver] pass ${p + 1}/${args.passes} ok (${blocks.length} blocks, head root ${lastRoot})`);
    }
  }

  const took = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[driver] done: ${args.passes} pass(es), ${totalImports} block import(s) in ${took}s`);
  client.close();
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`[driver] FAILED: ${e instanceof Error ? e.stack : e}`);
    process.exit(1);
  },
);
