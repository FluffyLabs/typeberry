import type { WorkReportHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { Ed25519Key } from "@typeberry/crypto";
import { type FromJson, json } from "@typeberry/json-parser";
import { DisputesRecords } from "@typeberry/state";

export const disputesRecordsFromJson: FromJson<DisputesRecords> = json.object<JsonDisputesRecords, DisputesRecords>(
  {
    good: json.array(fromJson.bytes32<WorkReportHash>()),
    bad: json.array(fromJson.bytes32<WorkReportHash>()),
    wonky: json.array(fromJson.bytes32<WorkReportHash>()),
    offenders: json.array(fromJson.bytes32<Ed25519Key>()),
  },
  ({ good, bad, wonky, offenders }) => {
    return DisputesRecords.fromSortedArrays({
      goodSet: good,
      badSet: bad,
      wonkySet: wonky,
      punishSet: offenders,
    });
  },
);

class JsonDisputesRecords {
  /**
   * psi = {psi_g, psi_b, psi_w, psi_o}
   * GP: https://graypaper.fluffylabs.dev/#/364735a/121400123100
   */
  /** "Good" set */
  good!: WorkReportHash[];
  /** "Bad" set */
  bad!: WorkReportHash[];
  /** "Wonky" set */
  wonky!: WorkReportHash[];
  /** "Punish" set */
  offenders!: Ed25519Key[];
}
