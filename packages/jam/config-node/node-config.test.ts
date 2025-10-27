import assert from "node:assert";
import fs from "node:fs";
import { beforeEach, describe, it, mock } from "node:test";
import { configs } from "@typeberry/configs";
import { parseFromJson } from "@typeberry/json-parser";
import { workspacePathFix } from "@typeberry/utils";
import { KnownChainSpec, loadConfig, NodeConfiguration } from "./node-config.js";

const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

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

describe("Load dev config", () => {
  it("should load dev config without crashing", () => {
    loadConfig(["dev"], withRelPath);
  });
});

describe("loadConfig", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it("should load default config if not specified", () => {
    const config = loadConfig([], withRelPath);
    assert.deepStrictEqual(config, parseFromJson(configs.default, NodeConfiguration.fromJson));
  });

  it("should load default config if specified", () => {
    const config = loadConfig(["default"], withRelPath);
    assert.deepStrictEqual(config, parseFromJson(configs.default, NodeConfiguration.fromJson));
  });

  it("should load dev config", () => {
    const config = loadConfig(["dev"], withRelPath);
    assert.deepStrictEqual(config, parseFromJson(configs.dev, NodeConfiguration.fromJson));
  });

  it("should parse inline json config and deep merge onto default config", () => {
    const config = loadConfig(
      [JSON.stringify({ database_base_path: "/test/path", chain_spec: { bootnodes: [] } })],
      withRelPath,
    );
    assert.deepStrictEqual(
      config,
      parseFromJson(
        {
          ...configs.default,
          database_base_path: "/test/path",
          chain_spec: { ...configs.default.chain_spec, bootnodes: [] },
        },
        NodeConfiguration.fromJson,
      ),
    );
  });

  it("should load config from file if a valid file path is specified", () => {
    mock.method(fs, "existsSync", (src: string) => src === withRelPath("file.json"));
    mock.method(fs, "statSync", () => ({ isFile: () => true }));
    mock.method(fs, "readFileSync", () =>
      JSON.stringify({ database_base_path: "/test/path", chain_spec: { bootnodes: [] } }),
    );
    const config = loadConfig(["file.json"], withRelPath);
    assert.deepStrictEqual(
      config,
      parseFromJson(
        {
          ...configs.default,
          database_base_path: "/test/path",
          chain_spec: { ...configs.default.chain_spec, bootnodes: [] },
        },
        NodeConfiguration.fromJson,
      ),
    );
  });

  it("should apply pseudo-jq queries by replacement", () => {
    const config = loadConfig([".chain_spec.bootnodes=[]"], withRelPath);
    assert.deepStrictEqual(
      config,
      parseFromJson(
        {
          ...configs.default,
          chain_spec: { ...configs.default.chain_spec, bootnodes: [] },
        },
        NodeConfiguration.fromJson,
      ),
    );
  });

  it("should apply pseudo-jq queries by merging", () => {
    const config = loadConfig([`.chain_spec+={"bootnodes": []}`], withRelPath);
    assert.deepStrictEqual(
      config,
      parseFromJson(
        {
          ...configs.default,
          chain_spec: { ...configs.default.chain_spec, bootnodes: [] },
        },
        NodeConfiguration.fromJson,
      ),
    );
  });

  it("should load config from files specified in a pseudo-jq query", () => {
    mock.method(fs, "existsSync", (src: string) => src === withRelPath("file.json"));
    mock.method(fs, "statSync", () => ({ isFile: () => true }));
    mock.method(fs, "readFileSync", () => JSON.stringify({ bootnodes: [] }));
    const config = loadConfig([".chain_spec+=file.json"], withRelPath);
    assert.deepStrictEqual(
      config,
      parseFromJson(
        {
          ...configs.default,
          chain_spec: { ...configs.default.chain_spec, bootnodes: [] },
        },
        NodeConfiguration.fromJson,
      ),
    );
  });

  it("should stack several config entries in order from left to right", () => {
    const config = loadConfig(
      [
        "dev",
        `.chain_spec+={"bootnodes": []}`,
        `.database_base_path="/test/path"`,
        `.database_base_path="/test/path-1"`,
      ],
      withRelPath,
    );
    assert.deepStrictEqual(
      config,
      parseFromJson(
        {
          ...configs.dev,
          database_base_path: "/test/path-1",
          chain_spec: { ...configs.dev.chain_spec, bootnodes: [] },
        },
        NodeConfiguration.fromJson,
      ),
    );
  });

  it("should throw an error if an invalid json file is provided", () => {
    mock.method(fs, "existsSync", (src: string) => src === withRelPath("file.json"));
    mock.method(fs, "statSync", () => ({ isFile: () => true }));
    mock.method(fs, "readFileSync", () => "invalid json");
    assert.throws(
      () => loadConfig(["file.json"], withRelPath),
      new Error(
        `Unable to load config from file.json: SyntaxError: Unexpected token 'i', "invalid json" is not valid JSON`,
      ),
    );
  });

  it("should throw an error if an invalid json file is provided using a pseudo-jq query", () => {
    mock.method(fs, "existsSync", (src: string) => src === withRelPath("file.json"));
    mock.method(fs, "statSync", () => ({ isFile: () => true }));
    mock.method(fs, "readFileSync", () => "invalid json");
    assert.throws(
      () => loadConfig([".chain_spec+=file.json"], withRelPath),
      new Error(
        `Error while processing '.chain_spec+=file.json': Error: Unable to load config from file.json: SyntaxError: Unexpected token 'i', "invalid json" is not valid JSON`,
      ),
    );
  });

  it("should throw an error if the right side of a pseudo-jq query is not a valid json", () => {
    mock.method(fs, "existsSync", () => false);
    assert.throws(
      () => loadConfig([".chain_spec+=invalid json"], withRelPath),
      new Error(
        `Error while processing '.chain_spec+=invalid json': Error: Unrecognized syntax 'invalid json': SyntaxError: Unexpected token 'i', "invalid json" is not valid JSON`,
      ),
    );
  });

  it("should throw an error if the provided config is neither of the valid options (inline json, file path, pseudo-jq query)", () => {
    mock.method(fs, "existsSync", () => false);
    assert.throws(
      () => loadConfig(["invalid config"], withRelPath),
      new Error("Error while processing 'invalid config': Error: Unrecognized syntax."),
    );
  });

  it("should throw an error if the provided config has valid syntax but the resulting data is not a valid node config", () => {
    assert.throws(
      () => loadConfig([".chain_spec=1"], withRelPath),
      new Error(
        "Unable to parse config: Error: [<root>] Error while parsing the value: Error: [<root>.chain_spec] Error while parsing the value: Error: [<root>.chain_spec] Expected complex type but got number",
      ),
    );
  });
});
