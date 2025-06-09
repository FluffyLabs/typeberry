import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { parseFromJson } from "@typeberry/json-parser";
import { NetChainSpec } from "./net-chain-spec";

const NET_CHAIN_SPEC_TEST = {
  bootnodes: [
    "evysk4p563r2kappaebqykryquxw5lfcclvf23dqqhi5n765h4kkb@192.168.50.18:62061",
    "egy5qba5fyjf7hn7bxeroo7ncqfk5otxvo6or77k23o6pjqnxdoxb@192.168.50.20:63747",
    "evysk4p563r2kappaebqykryquxw5lfcclvf23dqqhi5n765h4kkb@[2001:0db8:85a3:0000:0000:8a2e:0370:7334]:62061",
    "egy5qba5fyjf7hn7bxeroo7ncqfk5otxvo6or77k23o6pjqnxdoxb@[2001:0db8:85a3:0000:0000:8a2e:0370:7335]:63747",
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
  const ncs = parseFromJson(NET_CHAIN_SPEC_TEST, NetChainSpec.fromJson);

  it("should read the net id", () => {
    assert.deepStrictEqual(ncs.id, "testnet");
  });

  it("should read the genesis header", () => {
    assert.deepStrictEqual(
      ncs.genesisHeader,
      BytesBlob.parseBlobNoPrefix(
        "1ee155ace9c40292074cb6aff8c9ccdd273c81648ff1149ef36bcea6ebb8a3e25bb30a42c1e62f0afda5f0a4e8a562f7a13a24cea00ee81917b86b89e801314aa4aa54d1a89973300d7e2493a1b512fecd848f4e8a63fb3a59d38a6b2c1610d9a2c98544eeb3df",
      ),
    );
  });

  it("should read bootnodes", () => {
    assert(ncs.bootnodes !== undefined);
    for (const bootnode of ncs.bootnodes) {
      assert(bootnode.name.length > 0);
      assert(bootnode.ip.length > 0);
      assert(bootnode.port > 0 && bootnode.port < 65535);
    }
  });

  it("should read genesisState", () => {
    assert.deepStrictEqual(ncs.genesisState?.size, 5);
    const value = ncs.genesisState.values().next().value;
    assert.deepStrictEqual(
      value,
      BytesBlob.parseBlobNoPrefix("08b647818aef53ffdf401882ab552f3ea21a57bdfe3fb4554a518a6fea139ca894b0"),
    );
  });

  it("should not throw an error when the bootnodes are missing", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      bootnodes: undefined,
    };
    assert.doesNotThrow(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });

  it("should not throw an error when the bootnodes are empty", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      bootnodes: [],
    };
    assert.doesNotThrow(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });
});

describe("Importing Net Chain Spec: Error Handling", () => {
  it("should throw an error when the net id is missing", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      id: undefined,
    };
    assert.throws(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });

  it("should throw an error when the genesis header is missing", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      genesisHeader: undefined,
    };
    assert.throws(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });

  it("should throw an error when the genesis state is missing", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      genesisState: undefined,
    };
    assert.throws(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });

  it("should throw an error when bootnode has invalid format (1)", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      bootnodes: ["192.168.50.18:62061"],
    };
    assert.throws(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });

  it("should throw an error when bootnode has invalid format (2)", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      bootnodes: ["evysk4p563r2kappaebqykryquxw5lfcclvf23dqqhi5n765h4kkb"],
    };
    assert.throws(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });

  it("should throw an error when bootnode has invalid port (1)", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      bootnodes: ["evysk4p563r2kappaebqykryquxw5lfcclvf23dqqhi5n765h4kkb@192.168.50.18:port"],
    };
    assert.throws(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });

  it("should throw an error when bootnode has invalid port (2)", () => {
    const invalidSpec = {
      ...NET_CHAIN_SPEC_TEST,
      bootnodes: ["evysk4p563r2kappaebqykryquxw5lfcclvf23dqqhi5n765h4kkb@192.168.50.18:-62061"],
    };
    assert.throws(() => parseFromJson(invalidSpec, NetChainSpec.fromJson));
  });
});
