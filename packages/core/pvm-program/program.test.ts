import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";

import { deepEqual } from "@typeberry/utils/test";
import { CODE, METADATA, PREIMAGE_TEST_BLOB } from "./test-preimage-blob";
import { extractCodeAndMetadata } from "./program";

describe("extractCodeAndMetadata", () => {
  it("should correctly decode code with metadata", () => {
    const blobWithMetadata = BytesBlob.parseBlobNoPrefix(PREIMAGE_TEST_BLOB).raw;

    const { code, metadata } = extractCodeAndMetadata(blobWithMetadata);

    deepEqual(BytesBlob.blobFrom(code), BytesBlob.parseBlobNoPrefix(CODE));
    deepEqual(BytesBlob.blobFrom(metadata), BytesBlob.parseBlobNoPrefix(METADATA));
  });
});
