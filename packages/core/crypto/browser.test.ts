import assert from "node:assert";
import { describe, it } from "node:test";
import * as bandersnatch from "./bandersnatch.js";
import * as browser from "./browser.js";
import * as ed25519 from "./ed25519.js";

describe("browser-safe crypto constants", () => {
  it("match their canonical implementation values", () => {
    assert.strictEqual(browser.ED25519_PRIV_KEY_BYTES, ed25519.ED25519_PRIV_KEY_BYTES);
    assert.strictEqual(browser.ED25519_KEY_BYTES, ed25519.ED25519_KEY_BYTES);
    assert.strictEqual(browser.ED25519_SIGNATURE_BYTES, ed25519.ED25519_SIGNATURE_BYTES);
    assert.strictEqual(browser.BANDERSNATCH_KEY_BYTES, bandersnatch.BANDERSNATCH_KEY_BYTES);
    assert.strictEqual(browser.BANDERSNATCH_VRF_SIGNATURE_BYTES, bandersnatch.BANDERSNATCH_VRF_SIGNATURE_BYTES);
    assert.strictEqual(browser.BANDERSNATCH_RING_ROOT_BYTES, bandersnatch.BANDERSNATCH_RING_ROOT_BYTES);
    assert.strictEqual(browser.BANDERSNATCH_PROOF_BYTES, bandersnatch.BANDERSNATCH_PROOF_BYTES);
    assert.strictEqual(browser.BLS_KEY_BYTES, bandersnatch.BLS_KEY_BYTES);
  });
});
