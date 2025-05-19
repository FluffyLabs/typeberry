import assert from "node:assert";
import { describe, it } from "node:test";

import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  tryAsEpoch,
  tryAsPerValidator,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { Culprit, DisputesExtrinsic, Fault, Judgement, Verdict } from "@typeberry/block/disputes.js";
import { Bytes } from "@typeberry/bytes";
import { SortedSet, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { DisputesRecords, VALIDATOR_META_BYTES, ValidatorData, hashComparator, tryAsPerCore } from "@typeberry/state";
import { Disputes } from "./disputes.js";
import { DisputesErrorCode } from "./disputes-error-code.js";
import type { DisputesState } from "./disputes-state.js";

const createValidatorData = ({ bandersnatch, ed25519 }: { bandersnatch: string; ed25519: string }) =>
  ValidatorData.create({
    bandersnatch: Bytes.parseBytes(bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
    ed25519: Bytes.parseBytes(ed25519, ED25519_KEY_BYTES).asOpaque(),
    bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
    metadata: Bytes.zero(VALIDATOR_META_BYTES),
  });
const createVote = ({ vote, index, signature }: { vote: boolean; index: number; signature: string }) =>
  Judgement.create({
    isWorkReportValid: vote,
    index: tryAsValidatorIndex(index),
    signature: Bytes.parseBytes(signature, ED25519_SIGNATURE_BYTES).asOpaque(),
  });
const createVerdict = ({
  target,
  age,
  votes,
}: { target: string; age: number; votes: { vote: boolean; index: number; signature: string }[] }) =>
  Verdict.create({
    workReportHash: Bytes.parseBytes(target, HASH_SIZE).asOpaque(),
    votesEpoch: tryAsEpoch(age),
    votes: asKnownSize(votes.map(createVote)),
  });
const createCulprit = ({ target, key, signature }: { target: string; key: string; signature: string }) =>
  Culprit.create({
    workReportHash: Bytes.parseBytes(target, HASH_SIZE).asOpaque(),
    key: Bytes.parseBytes(key, ED25519_KEY_BYTES).asOpaque(),
    signature: Bytes.parseBytes(signature, ED25519_SIGNATURE_BYTES).asOpaque(),
  });
const createFault = ({
  target,
  vote,
  key,
  signature,
}: { target: string; vote: boolean; key: string; signature: string }) =>
  Fault.create({
    workReportHash: Bytes.parseBytes(target, HASH_SIZE).asOpaque(),
    wasConsideredValid: vote,
    key: Bytes.parseBytes(key, ED25519_KEY_BYTES).asOpaque(),
    signature: Bytes.parseBytes(signature, ED25519_SIGNATURE_BYTES).asOpaque(),
  });
const createOffender = (blob: string): Ed25519Key => Bytes.parseBytes(blob, ED25519_KEY_BYTES).asOpaque();

describe("Disputes", () => {
  const currentValidatorData = tryAsPerValidator(
    [
      {
        bandersnatch: "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
        ed25519: "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
      },
      {
        bandersnatch: "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
        ed25519: "0x22351e22105a19aabb42589162ad7f1ea0df1c25cebf0e4a9fcd261301274862",
      },
      {
        bandersnatch: "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
        ed25519: "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
      },
      {
        bandersnatch: "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
        ed25519: "0xb3e0e096b02e2ec98a3441410aeddd78c95e27a0da6f411a09c631c0f2bea6e9",
      },
      {
        bandersnatch: "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
        ed25519: "0x5c7f34a4bd4f2d04076a8c6f9060a0c8d2c6bdd082ceb3eda7df381cb260faff",
      },
      {
        bandersnatch: "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
        ed25519: "0x837ce344bc9defceb0d7de7e9e9925096768b7adb4dad932e532eb6551e0ea02",
      },
    ].map(createValidatorData),
    tinyChainSpec,
  );

  const previousValidatorData = tryAsPerValidator(
    [
      {
        bandersnatch: "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
        ed25519: "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
      },
      {
        bandersnatch: "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
        ed25519: "0x837ce344bc9defceb0d7de7e9e9925096768b7adb4dad932e532eb6551e0ea02",
      },
      {
        bandersnatch: "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
        ed25519: "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
      },
      {
        bandersnatch: "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
        ed25519: "0x5c7f34a4bd4f2d04076a8c6f9060a0c8d2c6bdd082ceb3eda7df381cb260faff",
      },
      {
        bandersnatch: "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
        ed25519: "0x22351e22105a19aabb42589162ad7f1ea0df1c25cebf0e4a9fcd261301274862",
      },
      {
        bandersnatch: "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
        ed25519: "0xb3e0e096b02e2ec98a3441410aeddd78c95e27a0da6f411a09c631c0f2bea6e9",
      },
    ].map(createValidatorData),
    tinyChainSpec,
  );

  const verdicts = [
    {
      target: "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
      age: 0,
      votes: [
        {
          vote: true,
          index: 0,
          signature:
            "0x0b1e29dbda5e3bba5dde21c81a8178b115ebf0cf5920fe1a38e897ecadd91718e34bf01c9fc7fdd0df31d83020231b6e8338c8dc204b618cbde16a03cb269d05",
        },
        {
          vote: true,
          index: 1,
          signature:
            "0x0d44746706e09ff6b6f2929e736c2f868a4d17939af6d37ca7d3c7f6d4914bd095a6fd4ff48c320b673e2de92bfdb5ed9f5c0c40749816ab4171a2272386fc05",
        },
        {
          vote: true,
          index: 2,
          signature:
            "0x0d5d39f2239b775b22aff53b74a0d708a9b9363ed5017170f0abebc8ffd97fc1cc3cf597c578b555ad5abab26e09ecda727c2909feae99587c6354b86e4cc50c",
        },
        {
          vote: true,
          index: 3,
          signature:
            "0x701d277fa78993b343a5d4367f1c2a2fb7ddb77f0246bf9028196feccbb7c0f2bd994966b3e9b1e51ff5dd63d8aa5e2331432b9cca4a125552c4700d51814a04",
        },
        {
          vote: true,
          index: 4,
          signature:
            "0x08d96d2e49546931dc3de989a69aa0ae3547d67a038bdaa84f7e549da8318d48aab72b4b30ecc0c588696305fce3e2c4657f409463f6a05c52bf641f2684460f",
        },
      ],
    },
    {
      target: "0x7b0aa1735e5ba58d3236316c671fe4f00ed366ee72417c9ed02a53a8019e85b8",
      age: 0,
      votes: [
        {
          vote: false,
          index: 0,
          signature:
            "0xd76bba06ffb8042bedce3f598e22423660e64f2108566cbd548f6d2c42b1a39607a214bddfa7ccccf83fe993728a58393c64283b8a9ab8f3dff49cbc3cc2350e",
        },
        {
          vote: false,
          index: 1,
          signature:
            "0x77edbe63b2cfab4bda9227bc9fcc8ac4aa8157616c3d8dff9f90fe88cc998fef871a57bbc43eaa1bdee241a1f903ffb42e39a4207c0752d9352f7d98835eda0a",
        },
        {
          vote: false,
          index: 2,
          signature:
            "0x1843d18350a8ddee1502bc47cbd1dd30a3354f24bf7e095ad848e8f0744afc4b04a224b5b2143297d571309799c3c0a17f1b7d7782aaeb8f4991cf5dd749310b",
        },
        {
          vote: false,
          index: 3,
          signature:
            "0x561bab9479abe38ed5d9609e92145fa689995ef2b71e94577a60eee6177663e8fd1f5bacd1f1afdadce1ea48598ad10a0893e733c34ab6f4aa821b0fdbdf0201",
        },
        {
          vote: false,
          index: 4,
          signature:
            "0xb579159c1ab983583ed8d95bf8632ac7d3be51bdff3d5221258105b801782a5146e08247c269c7bcec10bec76c7d648704e7e6bf3ace77951e828f23894b500c",
        },
      ],
    },
  ].map(createVerdict);

  const verdictsWithIncorrectValidatorIndex = [
    {
      target: "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
      age: 0,
      votes: [
        {
          vote: true,
          index: 65000,
          signature:
            "0x0b1e29dbda5e3bba5dde21c81a8178b115ebf0cf5920fe1a38e897ecadd91718e34bf01c9fc7fdd0df31d83020231b6e8338c8dc204b618cbde16a03cb269d05",
        },
        {
          vote: true,
          index: 1,
          signature:
            "0x0d44746706e09ff6b6f2929e736c2f868a4d17939af6d37ca7d3c7f6d4914bd095a6fd4ff48c320b673e2de92bfdb5ed9f5c0c40749816ab4171a2272386fc05",
        },
        {
          vote: true,
          index: 2,
          signature:
            "0x0d5d39f2239b775b22aff53b74a0d708a9b9363ed5017170f0abebc8ffd97fc1cc3cf597c578b555ad5abab26e09ecda727c2909feae99587c6354b86e4cc50c",
        },
        {
          vote: true,
          index: 3,
          signature:
            "0x701d277fa78993b343a5d4367f1c2a2fb7ddb77f0246bf9028196feccbb7c0f2bd994966b3e9b1e51ff5dd63d8aa5e2331432b9cca4a125552c4700d51814a04",
        },
        {
          vote: true,
          index: 4,
          signature:
            "0x08d96d2e49546931dc3de989a69aa0ae3547d67a038bdaa84f7e549da8318d48aab72b4b30ecc0c588696305fce3e2c4657f409463f6a05c52bf641f2684460f",
        },
      ],
    },
  ].map(createVerdict);

  const culprits = [
    {
      target: "0x7b0aa1735e5ba58d3236316c671fe4f00ed366ee72417c9ed02a53a8019e85b8",
      key: "0x22351e22105a19aabb42589162ad7f1ea0df1c25cebf0e4a9fcd261301274862",
      signature:
        "0xa6a135b2f36906be1c00cd0e48425a38cbde296a5ff73d6de6d3b0e4c26f1761adbf563961da0d3611c24ee8f5c5781647f327513912cb58f1de4bc72b5e6f01",
    },
    {
      target: "0x7b0aa1735e5ba58d3236316c671fe4f00ed366ee72417c9ed02a53a8019e85b8",
      key: "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
      signature:
        "0x940439909168820e32e5788b293786e1e02e7377e32260a96997cb991638c8c88980d0a7a6f26c7fb9bb81282129fdaa09c87932db02cbfd9955dc1940b90a03",
    },
  ].map(createCulprit);

  const faults = [
    {
      target: "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
      vote: false,
      key: "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
      signature:
        "0x826a4bbe7ee3400ffe0f64bdd87ae65aa50d98f48ad6a60da927636cd430ae5d3914d3bc6b87c47c94a9cc5bef84bf30be5534e5c649fc2cd4434918a37a2301",
    },
  ].map(createFault);

  const preState: DisputesState = {
    disputesRecords: DisputesRecords.create({
      goodSet: SortedSet.fromArray(hashComparator),
      badSet: SortedSet.fromArray(hashComparator),
      wonkySet: SortedSet.fromArray(hashComparator),
      punishSet: SortedSet.fromArray(hashComparator),
    }),
    timeslot: tryAsTimeSlot(0),
    availabilityAssignment: tryAsPerCore([null, null], tinyChainSpec),
    currentValidatorData,
    previousValidatorData,
  };

  it("should perform correct state transition and return offenders", async () => {
    const disputes = new Disputes(tinyChainSpec, preState);
    const disputesExtrinsic = DisputesExtrinsic.create({ verdicts, culprits, faults });
    const offenders = [
      "0x22351e22105a19aabb42589162ad7f1ea0df1c25cebf0e4a9fcd261301274862",
      "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
      "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
    ].map(createOffender);

    const result = await disputes.transition(disputesExtrinsic);
    const error = result.isError ? result.error : undefined;
    const ok = result.isOk ? result.ok.slice() : undefined;

    assert.strictEqual(error, undefined);
    assert.deepStrictEqual(ok, offenders);
  });

  it("should return incorrect validator index error", async () => {
    const disputes = new Disputes(tinyChainSpec, preState);
    const disputesExtrinsic = DisputesExtrinsic.create({
      verdicts: verdictsWithIncorrectValidatorIndex,
      culprits,
      faults,
    });

    const result = await disputes.transition(disputesExtrinsic);
    const error = result.isError ? result.error : undefined;
    const ok = result.isOk ? result.ok.slice() : undefined;

    assert.strictEqual(error, DisputesErrorCode.BadValidatorIndex);
    assert.strictEqual(ok, undefined);
  });
});
