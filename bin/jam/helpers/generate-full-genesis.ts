#!/usr/bin/env tsx
// biome-ignore-all lint/suspicious/noConsole: bin file

// Generate a "full"-flavor dev config JSON with 1023 trivial-seed validators.
// Output goes to stdout; redirect to e.g. packages/configs/typeberry-dev-full.json
// then run with:
//   npm start -- --config packages/configs/typeberry-dev-full.json dev all --fast-forward

import {
  Block,
  DisputesExtrinsic,
  Extrinsic,
  Header,
  reencodeAsView,
  tryAsPerEpochBlock,
  tryAsPerValidator,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { fullChainSpec } from "@typeberry/config";
import { BLS_KEY_BYTES, initWasm } from "@typeberry/crypto";
import {
  deriveBandersnatchPublicKey,
  deriveBandersnatchSecretKey,
  deriveEd25519PublicKey,
  deriveEd25519SecretKey,
  trivialSeed,
} from "@typeberry/crypto/key-derivation.js";
import { Blake2b } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { InMemoryState, SafroleSealingKeysData, VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/state";
import { StateEntries } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType } from "@typeberry/utils";

async function main() {
  await initWasm();
  const blake2b = await Blake2b.createHasher();
  const bandersnatch = await BandernsatchWasm.new();
  const spec = fullChainSpec;
  const n = spec.validatorsCount;

  console.error(`Deriving ${n} validator keys...`);
  const validators: ValidatorData[] = [];
  for (let i = 0; i < n; i++) {
    const seed = trivialSeed(tryAsU32(i));
    const bandersnatchSecret = deriveBandersnatchSecretKey(seed, blake2b);
    const ed25519Secret = deriveEd25519SecretKey(seed, blake2b);
    const bandersnatchPub = deriveBandersnatchPublicKey(bandersnatchSecret);
    const ed25519Pub = await deriveEd25519PublicKey(ed25519Secret);
    validators.push(
      ValidatorData.create({
        bandersnatch: bandersnatchPub,
        ed25519: ed25519Pub,
        bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
        metadata: Bytes.zero(VALIDATOR_META_BYTES).asOpaque(),
      }),
    );
    if ((i + 1) % 100 === 0) {
      console.error(`  ${i + 1}/${n}`);
    }
  }

  console.error("Computing ring commitment...");
  const ringRootResult = await bandersnatchVrf.getRingCommitment(
    bandersnatch,
    validators.map((v) => v.bandersnatch),
  );
  if (ringRootResult.isError) {
    throw new Error(`Failed to compute ring commitment: ${ringRootResult.error}`);
  }
  const epochRoot = ringRootResult.ok;

  console.error("Building genesis state...");
  const state = InMemoryState.empty(spec);
  const perValidator = tryAsPerValidator(validators, spec);
  state.designatedValidatorData = perValidator;
  state.nextValidatorData = perValidator;
  state.currentValidatorData = perValidator;
  state.previousValidatorData = perValidator;
  state.epochRoot = epochRoot;
  // Fallback sealing keys: cycle bandersnatch keys across epoch slots. The first
  // epoch transition will recompute this via safrole; we only need a valid
  // SafroleSealingKeysData here so the genesis state encodes successfully.
  state.sealingKeySeries = SafroleSealingKeysData.keys(
    tryAsPerEpochBlock(
      Array.from({ length: spec.epochLength }, (_, i) => validators[i % n].bandersnatch),
      spec,
    ),
  );

  console.error("Serialising state entries...");
  const stateEntries = StateEntries.serializeInMemory(spec, blake2b, state);
  const stateRoot = stateEntries.getRootHash(blake2b);
  console.error(`Genesis state root: ${stateRoot}`);

  console.error("Building genesis header...");
  const hasher = await TransitionHasher.create();
  const extrinsic = Extrinsic.create({
    tickets: asOpaqueType(asKnownSize([])),
    preimages: [],
    guarantees: asOpaqueType(asKnownSize([])),
    assurances: asOpaqueType(asKnownSize([])),
    disputes: DisputesExtrinsic.create({ verdicts: [], culprits: [], faults: [] }),
  });
  const extrinsicView = reencodeAsView(Extrinsic.Codec, extrinsic, spec);
  const extrinsicHash = hasher.extrinsic(extrinsicView).hash;

  const header = Header.create({
    parentHeaderHash: Bytes.zero(32).asOpaque(),
    priorStateRoot: Bytes.zero(32).asOpaque(),
    extrinsicHash,
    timeSlotIndex: tryAsTimeSlot(0),
    epochMarker: null,
    ticketsMarker: null,
    bandersnatchBlockAuthorIndex: tryAsValidatorIndex(0xffff),
    entropySource: Bytes.zero(96).asOpaque(),
    offendersMarker: [],
    seal: Bytes.zero(96).asOpaque(),
  });
  const encodedHeader = Encoder.encodeObject(Header.Codec, header, spec);

  // Sanity check: roundtrip the genesis block through codec under fullChainSpec
  // so we catch any size/shape mismatches now instead of at node startup.
  reencodeAsView(Block.Codec, Block.create({ header, extrinsic }), spec);

  console.error("Encoding JSON...");
  const stateMap: Record<string, string> = {};
  for (const [key, value] of stateEntries) {
    stateMap[hexNoPrefix(key.raw)] = hexNoPrefix(value.raw);
  }

  const out = {
    $schema: "https://fluffylabs.dev/typeberry/schemas/config-v1.schema.json",
    version: 1,
    flavor: "full",
    authorship: {},
    chain_spec: {
      id: "typeberry-dev-full",
      bootnodes: [],
      genesis_header: hexNoPrefix(encodedHeader.raw),
      genesis_state: stateMap,
    },
  };
  process.stdout.write(JSON.stringify(out, null, 2));
  process.stdout.write("\n");
}

function hexNoPrefix(bytes: Uint8Array): string {
  return BytesBlob.blobFrom(bytes).toString().slice(2);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
