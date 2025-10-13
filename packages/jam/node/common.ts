import {
  Block,
  type BlockView,
  emptyBlock,
  Header,
  type HeaderHash,
  reencodeAsView,
  type TimeSlot,
} from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type JipChainSpec, KnownChainSpec } from "@typeberry/config-node";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { type Blake2b, HASH_SIZE, WithHash } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { SerializedState, StateEntries } from "@typeberry/state-merkleization";

export const logger = Logger.new(import.meta.filename, "jam");

export function getChainSpec(name: KnownChainSpec) {
  if (name === KnownChainSpec.Full) {
    return fullChainSpec;
  }

  if (name === KnownChainSpec.Tiny) {
    return tinyChainSpec;
  }

  throw new Error(`Unknown chain spec: ${name}. Possible options: ${[KnownChainSpec.Full, KnownChainSpec.Tiny]}`);
}

export function openDatabase(
  blake2b: Blake2b,
  nodeName: string,
  genesisHeader: BytesBlob,
  databaseBasePath: string,
  { readOnly = false }: { readOnly?: boolean } = {},
) {
  const nodeNameHash = blake2b.hashString(nodeName).toString().substring(2, 10);
  const genesisHeaderHash = blake2b.hashBytes(genesisHeader).asOpaque<HeaderHash>();
  const genesisHeaderHashNibbles = genesisHeaderHash.toString().substring(2, 10);

  const dbPath = `${databaseBasePath}/${nodeNameHash}/${genesisHeaderHashNibbles}`;
  logger.info`🛢️ Opening database at ${dbPath}`;
  try {
    return {
      dbPath,
      rootDb: new LmdbRoot(dbPath, readOnly),
      genesisHeaderHash,
    };
  } catch (e) {
    throw new Error(`Unable to open database at ${dbPath}: ${e}`);
  }
}

/**
 * Initialize the database unless it's already initialized.
 *
 * The function checks the genesis header
 */
export async function initializeDatabase(
  spec: ChainSpec,
  blake2b: Blake2b,
  genesisHeaderHash: HeaderHash,
  rootDb: LmdbRoot,
  config: JipChainSpec,
  ancestry: [HeaderHash, TimeSlot][],
): Promise<void> {
  const blocks = new LmdbBlocks(spec, rootDb);
  const states = new LmdbStates(spec, blake2b, rootDb);

  const header = blocks.getBestHeaderHash();
  const state = blocks.getPostStateRoot(header);
  logger.log`🛢️ Best header hash: ${header}`;
  logger.log`🛢️ Best state root: ${state}`;

  // DB seems already initialized, just go with what we have.
  const isDbInitialized =
    state !== null && !state.isEqualTo(Bytes.zero(HASH_SIZE)) && !header.isEqualTo(Bytes.zero(HASH_SIZE));

  if (isDbInitialized) {
    return;
  }

  logger.log`🛢️ Database looks fresh. Initializing.`;
  // looks like a fresh db, initialize the state.
  const genesisHeader = Decoder.decodeObject(Header.Codec, config.genesisHeader, spec);
  const genesisExtrinsic = emptyBlock().extrinsic;
  const genesisBlock = Block.create({ header: genesisHeader, extrinsic: genesisExtrinsic });
  const blockView = reencodeAsView(Block.Codec, genesisBlock, spec);
  logger.log`🧬 Writing genesis block #${genesisHeader.timeSlotIndex}: ${genesisHeaderHash}`;

  const { genesisStateSerialized, genesisStateRootHash } = loadGenesisState(spec, blake2b, config.genesisState);

  // write to db
  await blocks.insertBlock(new WithHash<HeaderHash, BlockView>(genesisHeaderHash, blockView));
  // insert fake blocks for ancestry data
  for (const [hash, slot] of ancestry) {
    await blocks.insertBlock(new WithHash(hash, reencodeAsView(Block.Codec, emptyBlock(slot), spec)));
  }
  await states.insertInitialState(genesisHeaderHash, genesisStateSerialized);
  await blocks.setPostStateRoot(genesisHeaderHash, genesisStateRootHash);
  await blocks.setBestHeaderHash(genesisHeaderHash);
}

function loadGenesisState(spec: ChainSpec, blake2b: Blake2b, data: JipChainSpec["genesisState"]) {
  const stateEntries = StateEntries.fromEntriesUnsafe(data.entries());
  const state = SerializedState.fromStateEntries(spec, blake2b, stateEntries);

  const genesisStateRootHash = stateEntries.getRootHash(blake2b);
  logger.info`🧬 Genesis state root: ${genesisStateRootHash}`;

  return {
    genesisState: state,
    genesisStateSerialized: stateEntries,
    genesisStateRootHash,
  };
}
