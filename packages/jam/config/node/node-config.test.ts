import assert from "node:assert";
import { describe, it } from "node:test";
import { parseFromJson } from "@typeberry/json-parser";
import { KnownChainSpec, NodeConfiguration } from "./node-config.js";

const NODE_CONFIG_TEST = {
  $schema: "https://typeberry.dev/schemas/config-v1.schema.json",
  version: 1,
  flavor: "tiny",
  chain_spec: {
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
    },
  },
  database_base_path: "/tmp/jam-node-db",
  authorship: {
    omit_seal_verification: true,
  },
};

describe("Importing Node Configuration", () => {
  const config = parseFromJson(NODE_CONFIG_TEST, NodeConfiguration.fromJson);

  it("should read the schema", () => {
    assert.deepStrictEqual(config.$schema, "https://typeberry.dev/schemas/config-v1.schema.json");
  });

  it("should read the version", () => {
    assert.deepStrictEqual(config.version, 1);
  });

  it("should read the flavor", () => {
    assert.deepStrictEqual(config.flavor, KnownChainSpec.Tiny);
  });

  it("should read the database base path", () => {
    assert.deepStrictEqual(config.databaseBasePath, "/tmp/jam-node-db");
  });

  it("should read the chain spec", () => {
    assert.deepStrictEqual(config.chainSpec.id, "testnet");
    assert(config.chainSpec.bootnodes !== undefined);
    assert.deepStrictEqual(config.chainSpec.bootnodes.length, 2);
  });

  it("should read the authorship options", () => {
    assert.deepStrictEqual(config.authorship.omitSealVerification, true);
  });
});

describe("Importing Node Configuration: Error Handling", () => {
  it("should throw an error when version is not 1", () => {
    const invalidConfig = {
      ...NODE_CONFIG_TEST,
      version: 2,
    };
    assert.throws(() => parseFromJson(invalidConfig, NodeConfiguration.fromJson));
  });
});
