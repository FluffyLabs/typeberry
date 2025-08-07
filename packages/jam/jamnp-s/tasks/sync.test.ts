import assert, { deepEqual } from "node:assert";
import { describe, it } from "node:test";
import { setTimeout } from "node:timers/promises";
import {
  Block,
  type BlockView,
  Header,
  type HeaderHash,
  type HeaderView,
  type StateRootHash,
  type TimeSlot,
  tryAsTimeSlot,
} from "@typeberry/block";
import { testBlockView } from "@typeberry/block/test-helpers.js";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { MockNetwork, createTestPeerPair } from "@typeberry/networking/testing.js";
import { setupPeerListeners } from "../network.js";
import { Connections } from "../peers.js";
import { StreamManager } from "../stream-manager.js";
import { SyncResult, SyncTask } from "./sync.js";

const logger = Logger.new(import.meta.filename, "test:net");

const spec = tinyChainSpec;

const toBlockView = (block: Block): BlockView => {
  const encodedBlock = Encoder.encodeObject(Block.Codec, block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);
  return blockView;
};

const toHeaderView = (header: Header): HeaderView => {
  const encodedHeader = Encoder.encodeObject(Header.Codec, header, spec);
  const headerView = Decoder.decodeObject(Header.Codec.View, encodedHeader, spec);
  return headerView;
};

describe("SyncTask", () => {
  async function init(name: string, ourBlocks: WithHash<HeaderHash, Block>[] = []) {
    const network = new MockNetwork(name);
    const streamManager = new StreamManager();
    const connections = new Connections(network);
    const blocksDb = await setupTestDatabase(ourBlocks);
    const receivedBlocks: Block[][] = [];
    const onNewBlocks = (blocks: BlockView[]) => {
      receivedBlocks.push(blocks.map((view) => view.materialize()));
    };

    const syncTask = SyncTask.start(spec, streamManager, connections, blocksDb, onNewBlocks);

    setupPeerListeners(syncTask, network, streamManager);

    let connectionIdx = 0;
    const openConnection = (other: { name: string; network: MockNetwork }) => {
      // we need to create a pair of peers that connected together
      const [self, peer1] = createTestPeerPair(connectionIdx++, name, other.name);
      network._peers.peerConnected(peer1);
      other.network._peers.peerConnected(self);

      return [self, peer1] as const;
    };

    return {
      name,
      syncTask,
      network,
      receivedBlocks,
      connections,
      openConnection,
    };
  }

  async function tick() {
    logger.log("tick");
    // TODO [ToDr] This is pretty imperfect. We basically need some way,
    // to let the background reading tasks to process incoming data.
    // Might be good enough? 🤷
    await setTimeout(1);
  }

  it("should maintain sync with no peers", async () => {
    // Setup
    const { syncTask } = await init("self", blocksSeq({ start: 5 }));

    const result = syncTask.maintainSync();
    deepEqual(result, {
      kind: SyncResult.NoNewBlocks,
      ours: tryAsTimeSlot(5),
      // we assume that our block is the best seen so far.
      theirs: tryAsTimeSlot(5),
    });
  });

  it("should sync with one peer", async () => {
    const self = await init("self", blocksSeq({ start: 5, end: 7 }));
    const peer1 = await init("peer1", blocksSeq({ start: 5, end: 10 }));
    self.openConnection(peer1);
    await tick();

    const resultPeer = peer1.syncTask.maintainSync();
    deepEqual(resultPeer, {
      kind: SyncResult.NoNewBlocks,
      ours: tryAsTimeSlot(10),
      // we assume that our block is the best seen so far.
      theirs: tryAsTimeSlot(10),
    });

    const result = self.syncTask.maintainSync();
    deepEqual(result, {
      kind: SyncResult.BlocksRequested,
      ours: tryAsTimeSlot(7),
      requested: [
        {
          count: 3,
          peerId: "peer1",
          theirs: 10,
        },
      ],
    });

    await tick();

    deepEqual(
      self.receivedBlocks[0].map((x) => x.header.timeSlotIndex),
      [7, 8, 9, 10],
    );
  });

  it("should sync with multiple peers", async () => {
    const self = await init("self", blocksSeq({ start: 5, end: 7 }));
    const peer1 = await init("peer1", blocksSeq({ start: 5, end: 10 }));
    const peer2 = await init("peer2", blocksSeq({ start: 5, end: 12 }));
    self.openConnection(peer1);
    self.openConnection(peer2);
    await tick();

    const resultSelf = self.syncTask.maintainSync();
    deepEqual(resultSelf, {
      kind: SyncResult.BlocksRequested,
      ours: tryAsTimeSlot(7),
      requested: [
        {
          count: 3,
          peerId: "peer1",
          theirs: 10,
        },
        {
          count: 5,
          peerId: "peer2",
          theirs: 12,
        },
      ],
    });

    await tick();

    deepEqual(
      self.receivedBlocks.map((chunk) => chunk.map((block) => block.header.timeSlotIndex)),
      [
        [7, 8, 9, 10],
        [7, 8, 9, 10, 11, 12],
      ],
    );
  });

  it("should broadcast our header to one connected peers", async () => {
    await broadcastTest(1);
  });

  it("should broadcast our header to two connected peers", async () => {
    await broadcastTest(2);
  });

  it("should broadcast our header to multiple connected peers", async () => {
    await broadcastTest(10);
  });

  async function broadcastTest(peersCount: number) {
    const blocks = blocksSeq({ start: 0, end: 1 });
    const newBlock = blocks.pop();
    assert.ok(newBlock !== undefined);

    const self = await init("self", blocks);
    const peers = await Promise.all(
      Array.from({ length: peersCount }).map((_v, id) => {
        return init(`peer${id}`, blocks);
      }),
    );

    for (const p of peers) {
      self.openConnection(p);
    }
    await tick();

    for (const p of peers) {
      deepEqual(p.syncTask.maintainSync().kind, SyncResult.NoNewBlocks);
    }

    // Send broadcast
    self.syncTask.broadcastHeader(new WithHash(newBlock.hash, toHeaderView(newBlock.data.header)));
    await tick();

    for (const p of peers) {
      deepEqual(p.syncTask.maintainSync(), {
        kind: SyncResult.BlocksRequested,
        ours: tryAsTimeSlot(0),
        requested: [
          {
            count: 1,
            peerId: "self",
            theirs: tryAsTimeSlot(1),
          },
        ],
      });
    }
  }
});

function blocksSeq({
  start,
  end = start,
}: {
  start: number;
  end?: number;
}) {
  if (start > end) {
    throw new Error(`No blocks to create: ${start} > ${end}`);
  }

  const blocks: WithHash<HeaderHash, Block>[] = [];
  for (let i = start; i <= end; i++) {
    const prev = blocks.length > 0 ? blocks[blocks.length - 1] : null;
    const parentHash = prev?.hash ?? Bytes.zero(HASH_SIZE).asOpaque();
    blocks.push(
      createTestBlock({
        parentHash,
        timeSlot: tryAsTimeSlot(i),
      }),
    );
  }
  return blocks;
}

function createTestBlock(
  options: {
    parentHash?: HeaderHash;
    timeSlot?: TimeSlot;
    stateRoot?: StateRootHash;
  } = {},
): WithHash<HeaderHash, Block> {
  const block = testBlockView().materialize();
  if (options.parentHash !== undefined) {
    block.header.parentHeaderHash = options.parentHash;
  }
  if (options.timeSlot !== undefined) {
    block.header.timeSlotIndex = options.timeSlot;
  }
  if (options.stateRoot !== undefined) {
    block.header.priorStateRoot = options.stateRoot;
  }
  const view = toBlockView(block);
  const headerHash = blake2b.hashBytes(view.header.encoded());
  return new WithHash(headerHash.asOpaque<HeaderHash>(), block);
}

async function setupTestDatabase(inBlocks: WithHash<HeaderHash, Block>[] = []): Promise<InMemoryBlocks> {
  const db = InMemoryBlocks.new();
  let blocks = inBlocks;

  if (blocks.length === 0) {
    // Create a genesis block by default
    const genesisBlock = createTestBlock({ timeSlot: tryAsTimeSlot(0) });
    blocks = [genesisBlock];
  }

  // Insert blocks and set the last one as best
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockView = toBlockView(block.data);

    await db.insertBlock(new WithHash(block.hash, blockView));
  }

  // Set the last block as best
  if (blocks.length > 0) {
    await db.setBestHeaderHash(blocks[blocks.length - 1].hash);
  }

  return db;
}
