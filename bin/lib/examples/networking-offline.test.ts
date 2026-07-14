import assert from "node:assert";
import { describe, it } from "node:test";

describe("Offline Networking Example", () => {
  it("should submit blocks and observe outgoing announcements", async () => {
    // <!-- example:networking-offline -->
    const { startOfflineNetworkingWorker } = await import("@typeberry/lib/networking-offline");
    const { Block, emptyBlock, reencodeAsView } = await import("@typeberry/lib/block");
    type BlockView = import("@typeberry/lib/block").BlockView;
    type HeaderHash = import("@typeberry/lib/block").HeaderHash;
    const { Bytes } = await import("@typeberry/lib/bytes");
    const { tinyChainSpec } = await import("@typeberry/lib/config");
    const { HASH_SIZE, WithHash } = await import("@typeberry/lib/hash");
    const { DirectPort } = await import("@typeberry/lib/workers-api");

    const authorshipPorts = DirectPort.pair();
    const worker = startOfflineNetworkingWorker(authorshipPorts[0]);
    // Connect authorshipPorts[1] to block authorship.

    // Connect blocks received through offline networking to the importer.
    const importedBlocks: BlockView[] = [];
    worker.network.setOnBlocks(async (blocks) => {
      importedBlocks.push(...blocks);
    });

    const block = reencodeAsView(Block.Codec, emptyBlock(), tinyChainSpec);
    await worker.offline.submitBlock(block);
    assert.strictEqual(importedBlocks[0], block);

    // Outgoing online-network announcements are observable programmatically.
    let announcedHeader: unknown = null;
    worker.offline.announcedHeaders.once((header) => {
      announcedHeader = header;
    });
    const header = WithHash.new(Bytes.zero(HASH_SIZE).asOpaque<HeaderHash>(), block.header.view());
    await worker.network.sendNewHeader(header);
    assert.strictEqual(announcedHeader, header);

    await worker.finish();
    // <!-- /example:networking-offline -->
  });
});
