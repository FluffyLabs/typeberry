import { type StateRootHash, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, type Descriptor, codec } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { TruncatedHashDictionary } from "@typeberry/database";
import { HASH_SIZE } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { tryAsU32 } from "@typeberry/numbers";
import {
  InMemoryState,
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  type ServicesUpdate,
  type State,
  StorageItem,
  UpdatePreimage,
  UpdateService,
  UpdateStorage,
} from "@typeberry/state";
import { serialize, SerializedState, StateEntries, StateKey } from "@typeberry/state-merkleization";
import { resultToString } from "@typeberry/utils";

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
