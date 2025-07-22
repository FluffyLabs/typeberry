import type { StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { TruncatedHashDictionary } from "@typeberry/database";
import { HASH_SIZE } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { SerializedState, StateEntries, type StateKey } from "@typeberry/state-merkleization";

type KeyValEntry = {
  key: Bytes<31>;
  value: BytesBlob;
};

const keyValEntryFromJson = json.object<KeyValEntry>(
  {
    key: json.fromString<Bytes<31>>((v) => Bytes.parseBytes(v, 31).asOpaque()),
    value: json.fromString(BytesBlob.parseBlob),
  },
  ({ key, value }) => ({ key, value }),
);

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.array(keyValEntryFromJson),
  };

  static Codec = codec.object({
    state_root: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    keyvals: codec.sequenceVarLen(
      codec.object({
        key: codec.bytes(31),
        value: codec.blob,
      }),
    ),
  });

  state_root!: StateRootHash;
  keyvals!: KeyValEntry[];
}

export function loadState(spec: ChainSpec, keyvals: KeyValEntry[]) {
  const stateDict = TruncatedHashDictionary.fromEntries<StateKey, BytesBlob>(
    keyvals.map(({ key, value }) => [key, value]),
  );
  const stateEntries = StateEntries.fromTruncatedDictionaryUnsafe(stateDict);
  return SerializedState.fromStateEntries(spec, stateEntries);
}
