import { type EntropyHash, type PerEpochBlock, tryAsPerEpochBlock, tryAsServiceGas } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash, WorkPackageHash } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { HashSet, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { BLS_KEY_BYTES, type BandersnatchKey, type Ed25519Key } from "@typeberry/crypto";
import { type FromJson, json } from "@typeberry/json-parser";
import { BANDERSNATCH_RING_ROOT_BYTES } from "@typeberry/safrole/bandersnatch-vrf.js";
import {
  type InMemoryService,
  InMemoryState,
  PrivilegedServices,
  type State,
  VALIDATOR_META_BYTES,
  ValidatorData,
  tryAsPerCore,
} from "@typeberry/state";
import { JsonService } from "./accounts.js";
import { availabilityAssignmentFromJson } from "./availability-assignment.js";
import { disputesRecordsFromJson } from "./disputes.js";
import { notYetAccumulatedFromJson } from "./not-yet-accumulated.js";
import { blockStateFromJson } from "./recent-history.js";
import { TicketsOrKeys, ticketFromJson } from "./safrole.js";
import { JsonStatisticsData } from "./statistics.js";

const validatorDataFromJson: FromJson<ValidatorData> = json.object<ValidatorData>(
  {
    bandersnatch: fromJson.bytes32<BandersnatchKey>(),
    ed25519: fromJson.bytes32<Ed25519Key>(),
    bls: json.fromString((v) => Bytes.parseBytes(v, BLS_KEY_BYTES).asOpaque()),
    metadata: json.fromString((v) => Bytes.parseBytes(v, VALIDATOR_META_BYTES).asOpaque()),
  },
  ValidatorData.create,
);

type JsonStateDump = {
  alpha: AuthorizerHash[][];
  varphi: AuthorizerHash[][];
  beta: State["recentBlocks"] | null;
  gamma: {
    gamma_k: State["nextValidatorData"];
    gamma_z: State["epochRoot"];
    gamma_s: TicketsOrKeys;
    gamma_a: State["ticketsAccumulator"];
  };
  psi: State["disputesRecords"];
  eta: State["entropy"];
  iota: State["designatedValidatorData"];
  kappa: State["currentValidatorData"];
  lambda: State["previousValidatorData"];
  rho: State["availabilityAssignment"];
  tau: State["timeslot"];
  chi: {
    chi_m: PrivilegedServices["manager"];
    chi_a: PrivilegedServices["authManager"];
    chi_v: PrivilegedServices["validatorsManager"];
    chi_g: PrivilegedServices["autoAccumulateServices"] | null;
  };
  pi: JsonStatisticsData;
  theta: State["accumulationQueue"];
  xi: PerEpochBlock<WorkPackageHash[]>;
  accounts: InMemoryService[];
};

export const fullStateDumpFromJson = (spec: ChainSpec) =>
  json.object<JsonStateDump, InMemoryState>(
    {
      alpha: json.array(json.array(fromJson.bytes32<AuthorizerHash>())),
      varphi: json.array(json.array(fromJson.bytes32<AuthorizerHash>())),
      beta: json.nullable(json.array(blockStateFromJson)),
      gamma: {
        gamma_k: json.array(validatorDataFromJson),
        gamma_a: json.array(ticketFromJson),
        gamma_s: TicketsOrKeys.fromJson,
        gamma_z: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_RING_ROOT_BYTES).asOpaque()),
      },
      psi: disputesRecordsFromJson,
      eta: json.array(fromJson.bytes32<EntropyHash>()),
      iota: json.array(validatorDataFromJson),
      kappa: json.array(validatorDataFromJson),
      lambda: json.array(validatorDataFromJson),
      rho: json.array(json.nullable(availabilityAssignmentFromJson)),
      tau: "number",
      chi: {
        chi_m: "number",
        chi_a: "number",
        chi_v: "number",
        chi_g: json.nullable(
          json.array({
            service: "number",
            gasLimit: json.fromNumber((v) => tryAsServiceGas(v)),
          }),
        ),
      },
      pi: JsonStatisticsData.fromJson,
      theta: json.array(json.array(notYetAccumulatedFromJson)),
      xi: json.array(json.array(fromJson.bytes32())),
      accounts: json.array(JsonService.fromJson),
    },
    ({
      alpha,
      varphi,
      beta,
      gamma,
      psi,
      eta,
      iota,
      kappa,
      lambda,
      rho,
      tau,
      chi,
      pi,
      theta,
      xi,
      accounts,
    }): InMemoryState => {
      return InMemoryState.create({
        authPools: tryAsPerCore(
          alpha.map((perCore) => {
            if (perCore.length > MAX_AUTH_POOL_SIZE) {
              throw new Error(`AuthPools: expected less than ${MAX_AUTH_POOL_SIZE}, got ${perCore.length}`);
            }
            return asKnownSize(perCore);
          }),
          spec,
        ),
        authQueues: tryAsPerCore(
          varphi.map((perCore) => {
            if (perCore.length !== AUTHORIZATION_QUEUE_SIZE) {
              throw new Error(`AuthQueues: expected ${AUTHORIZATION_QUEUE_SIZE}, got: ${perCore.length}`);
            }
            return asKnownSize(perCore);
          }),
          spec,
        ),
        recentBlocks: beta ?? asKnownSize([]),
        nextValidatorData: gamma.gamma_k,
        epochRoot: gamma.gamma_z,
        sealingKeySeries: TicketsOrKeys.toSafroleSealingKeys(gamma.gamma_s, spec),
        ticketsAccumulator: gamma.gamma_a,
        disputesRecords: psi,
        entropy: eta,
        designatedValidatorData: iota,
        currentValidatorData: kappa,
        previousValidatorData: lambda,
        availabilityAssignment: rho,
        timeslot: tau,
        privilegedServices: PrivilegedServices.create({
          manager: chi.chi_m,
          authManager: chi.chi_a,
          validatorsManager: chi.chi_v,
          autoAccumulateServices: chi.chi_g ?? [],
        }),
        statistics: JsonStatisticsData.toStatisticsData(spec, pi),
        accumulationQueue: theta,
        recentlyAccumulated: tryAsPerEpochBlock(
          xi.map((x) => HashSet.from(x)),
          spec,
        ),
        services: new Map(accounts.map((x) => [x.serviceId, x])),
      });
    },
  );
