/**
 * Single-trace fuzz-target memory-leak driver.
 *
 * Decodes a single StateTransition trace (.bin) and repeatedly drives the
 * target through:
 *
 *    Initialize(pre_state)  ->  StateRoot
 *    ImportBlock(block)     ->  StateRoot (compared against post_state root)
 *
 * Re-initialising on every iteration is deliberate: each Initialize triggers
 * `resetState` on the target (close old node + rebuild via mainImporter), so
 * the loop exercises both the reset/close path and the import path - which is
 * exactly where a harness leak would accumulate.
 *
 * Requires the target to run with --init-genesis-from-ancestry (the trace is a
 * single isolated block, so parent/state-root checks must be skipped).
 *
 * This is a throwaway debugging tool; it is NOT part of the committed tree.
 */
import * as fs from "node:fs";
import { type BlockView, emptyBlock, type HeaderHash, tryAsTimeSlot } from "@typeberry/block";
import { Decoder } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { v1 } from "@typeberry/fuzz-proto";
import { StateTransition } from "@typeberry/state-vectors";
import { expectStateRoot, FuzzClient, handshake } from "./fuzz-client.js";

type Args = {
  socket: string;
  trace: string;
  iterations: number;
  spec: "auto" | "tiny" | "full";
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    socket: "/tmp/jam_target.sock",
    trace: "test-vectors-local/traces/00886505.bin",
    iterations: 1000,
    spec: "auto",
  };
  for (const arg of argv) {
    const [k, v] = arg.replace(/^--/, "").split("=");
    if (k === "socket" && v !== undefined) out.socket = v;
    else if (k === "trace" && v !== undefined) out.trace = v;
    else if (k === "iterations" && v !== undefined) out.iterations = Number(v);
    else if (k === "spec" && (v === "auto" || v === "tiny" || v === "full")) out.spec = v;
    else throw new Error(`Unrecognized argument: ${arg}`);
  }
  return out;
}

/** Decode the trace, figuring out the chain spec if it wasn't given explicitly. */
function loadTrace(path: string, specChoice: Args["spec"]): { test: StateTransition; spec: ChainSpec } {
  const data = fs.readFileSync(path);
  const candidates: [string, ChainSpec][] =
    specChoice === "tiny"
      ? [["tiny", tinyChainSpec]]
      : specChoice === "full"
        ? [["full", fullChainSpec]]
        : [
            ["tiny", tinyChainSpec],
            ["full", fullChainSpec],
          ];

  let lastErr: unknown;
  for (const [name, spec] of candidates) {
    try {
      const test = Decoder.decodeObject(StateTransition.Codec, data, spec);
      console.log(`[driver] decoded trace using '${name}' spec (${test.pre_state.keyvals.length} keyvals)`);
      return { test, spec };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not decode trace as a StateTransition with any known spec: ${lastErr}`);
}

function buildInitialize(test: StateTransition): v1.Initialize {
  const headerView = test.block.header.view();
  const parentHash = headerView.parentHeaderHash.materialize() as HeaderHash;
  const blockSlot = headerView.timeSlotIndex.materialize();
  // parent sits one slot before the block we're importing (guard against slot 0)
  const parentSlot = tryAsTimeSlot(blockSlot > 0 ? blockSlot - 1 : 0);

  // The genesis header content is irrelevant: with --init-genesis-from-ancestry
  // the target seeds the "best" block from ancestry[0], so the block's parent
  // lookup resolves to our pre_state. We only need a structurally valid Header.
  const header = emptyBlock(parentSlot).header;

  const keyvals = test.pre_state.keyvals.map((kv) => v1.KeyValue.create({ key: kv.key, value: kv.value }));
  const ancestry = [v1.AncestryItem.create({ slot: parentSlot, headerHash: parentHash })];

  return v1.Initialize.create({ header, keyvals, ancestry });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { test, spec } = loadTrace(args.trace, args.spec);

  const expectedRoot = test.post_state.state_root;
  const initMsg: v1.Message = { type: v1.MessageType.Initialize, value: buildInitialize(test) };
  const block: BlockView = test.block;
  const importMsg: v1.Message = { type: v1.MessageType.ImportBlock, value: block };

  console.log(`[driver] connecting to ${args.socket}`);
  const client = await FuzzClient.connect(args.socket, spec);
  const peer = await handshake(client);
  console.log(`[driver] handshook with '${peer.name}' (fuzz v${peer.fuzzVersion})`);

  const started = Date.now();
  for (let i = 0; i < args.iterations; i++) {
    expectStateRoot(await client.request(initMsg), `Initialize at iter ${i}`);
    const root = expectStateRoot(await client.request(importMsg), `ImportBlock at iter ${i}`);
    if (!root.isEqualTo(expectedRoot)) {
      throw new Error(`State root mismatch at iter ${i}:\n  got      ${root}\n  expected ${expectedRoot}`);
    }
    if (i === 0 || (i + 1) % 50 === 0) {
      console.log(`[driver] iter ${i + 1}/${args.iterations} ok (root ${expectedRoot})`);
    }
  }

  const took = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[driver] done: ${args.iterations} import(s) in ${took}s`);
  client.close();
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`[driver] FAILED: ${e instanceof Error ? e.stack : e}`);
    process.exit(1);
  },
);
