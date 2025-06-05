import assert from "node:assert";
import { describe, it } from "node:test";
import { parseFromJson } from "@typeberry/json-parser";
import { NetChainSpec } from "./net-chain-spec";

const NET_CHAIN_SPEC = {
  bootnodes: [
    "evysk4p563r2kappaebqykryquxw5lfcclvf23dqqhi5n765h4kkb@192.168.50.18:62061",
    "egy5qba5fyjf7hn7bxeroo7ncqfk5otxvo6or77k23o6pjqnxdoxb@192.168.50.20:63747",
  ],
  id: "testnet",
  genesis_header:
    "1ee155ace9c40292074cb6aff8c9ccdd273c81648ff1149ef36bcea6ebb8a3e25bb30a42c1e62f0afda5f0a4e8a562f7a13a24cea00ee81917b86b89e801314aa4aa54d1a89973300d7e2493a1b512fecd848f4e8a63fb3a59d38a6b2c1610d9a2c98544eeb3df",
  genesis_state: {
    "01000000000000000000000000000000000000000000000000000000000000":
      "08b647818aef53ffdf401882ab552f3ea21a57bdfe3fb4554a518a6fea139ca894b0",
    "09000000000000000000000000000000000000000000000000000000000000":
      "4aa54d1a89973300d7e2493a1b512fecd848f4e8a63fb3a59d38a6b2c1610d9a2c98",
    "0f000000000000000000000000000000000000000000000000000000000000": "000000000000000000000000",
    "0a000000000000000000000000000000000000000000000000000000000000": "0000",
    "00fe00ff00ff00ffa61a1135d89447673d804e5619daab939cd9c8936d4171":
      "5000156a616d2d626f6f7473747261702d7365727669636506302e312e32310a",
  },
};

describe("Importing Net Chain Spec", () => {
  it("should import the net chain spec", () => {
    const ncs = parseFromJson(NET_CHAIN_SPEC, NetChainSpec.fromJson);

    assert.deepEqual(ncs.id, "testnet");
    assert.deepEqual(
      ncs.genesis_header,
      "1ee155ace9c40292074cb6aff8c9ccdd273c81648ff1149ef36bcea6ebb8a3e25bb30a42c1e62f0afda5f0a4e8a562f7a13a24cea00ee81917b86b89e801314aa4aa54d1a89973300d7e2493a1b512fecd848f4e8a63fb3a59d38a6b2c1610d9a2c98544eeb3df",
    );
  });
});
