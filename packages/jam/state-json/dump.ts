import {
  type EntropyHash,
  type PerEpochBlock,
  tryAsPerEpochBlock,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE, MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash, WorkPackageHash } from "@typeberry/block/refine-context.js";
import { fromJson } from "@typeberry/block-json";
import { Bytes } from "@typeberry/bytes";
import { asKnownSize, HashSet, SortedArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_RING_ROOT_BYTES } from "@typeberry/crypto/bandersnatch.js";
import { json } from "@typeberry/json-parser";
import {
  type AccumulationOutput,
  accumulationOutputComparator,
  type InMemoryService,
  InMemoryState,
  PrivilegedServices,
  RecentBlocksHistory,
  type State,
  tryAsPerCore,
} from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { JsonService } from "./accounts.js";
import { accumulationOutput } from "./accumulation-output.js";
import { availabilityAssignmentFromJson } from "./availability-assignment.js";
import { disputesRecordsFromJson } from "./disputes.js";
import { notYetAccumulatedFromJson } from "./not-yet-accumulated.js";
import { recentBlocksHistoryFromJson } from "./recent-history.js";
import { TicketsOrKeys, ticketFromJson } from "./safrole.js";
import { JsonStatisticsData } from "./statistics.js";
import { validatorDataFromJson } from "./validator-data.js";

// NOTE State in line with GP ^0.7.0
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
    chi_a: PrivilegedServices["assigners"];
    chi_v: PrivilegedServices["delegator"];
    chi_r?: PrivilegedServices["registrar"];
    chi_g: PrivilegedServices["autoAccumulateServices"] | null;
  };
  pi: JsonStatisticsData;
  omega: State["accumulationQueue"];
  xi: PerEpochBlock<WorkPackageHash[]>;
  theta: AccumulationOutput[] | null;
  accounts: InMemoryService[];
};

export const fullStateDumpFromJson = (spec: ChainSpec) =>
  json.object<JsonStateDump, InMemoryState>(
    {
      alpha: json.array(json.array(fromJson.bytes32<AuthorizerHash>())),
      varphi: json.array(json.array(fromJson.bytes32<AuthorizerHash>())),
      beta: json.nullable(recentBlocksHistoryFromJson),
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
        chi_a: json.array("number"),
        chi_v: "number",
        chi_r: json.optional("number"),
        chi_g: json.nullable(
          json.array({
            service: "number",
            gasLimit: json.fromNumber((v) => tryAsServiceGas(v)),
          }),
        ),
      },
      pi: JsonStatisticsData.fromJson,
      omega: json.array(json.array(notYetAccumulatedFromJson)),
      xi: json.array(json.array(fromJson.bytes32())),
      theta: json.nullable(json.array(accumulationOutput)),
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
      omega,
      xi,
      theta,
      accounts,
    }): InMemoryState => {
      if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) && chi.chi_r === undefined)
        throw new Error("Registrar is required in Privileges GP ^0.7.1");
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
        recentBlocks: beta ?? RecentBlocksHistory.empty(),
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
          assigners: chi.chi_a,
          delegator: chi.chi_v,
          registrar: chi.chi_r ?? tryAsServiceId(2 ** 32 - 1),
          autoAccumulateServices: chi.chi_g ?? [],
        }),
        statistics: JsonStatisticsData.toStatisticsData(spec, pi),
        accumulationQueue: omega,
        recentlyAccumulated: tryAsPerEpochBlock(
          xi.map((x) => HashSet.from(x)),
          spec,
        ),
        accumulationOutputLog: SortedArray.fromArray(accumulationOutputComparator, theta ?? []),
        services: new Map(accounts.map((x) => [x.serviceId, x])),
      });
    },
  );
