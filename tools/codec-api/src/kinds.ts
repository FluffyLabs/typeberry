import {
  Block,
  EpochMarker,
  Extrinsic,
  Header,
  assurances,
  disputes,
  gaurantees,
  preimage,
  refineContext,
  tickets,
  workItem,
  workPackage,
  workReport,
  workResult,
} from "@typeberry/block";

function newKind<T>(name: string, clazz: T) {
  return { name, clazz };
}

const headerKind = newKind("Header", Header);
const blockKind = newKind("Block", Block);

export const kinds = [
  headerKind,
  blockKind,
  newKind("Extrinsic", Extrinsic),
  newKind("EpochMarker", EpochMarker),
  newKind("AvailabilityAssurance", assurances.AvailabilityAssurance),
  newKind(
    "AssurancesExtrinsic",
    class AssurancesExtrinsic extends Array {
      static Codec = assurances.assurancesExtrinsicCodec;
    },
  ),
  newKind("Culprit", disputes.Culprit),
  newKind("Fault", disputes.Fault),
  newKind("Judgement", disputes.Judgement),
  newKind("Verdict", disputes.Verdict),
  newKind("DisputesExtrinsic", disputes.DisputesExtrinsic),
  newKind("Credential", gaurantees.Credential),
  newKind("ReportGuarantee", gaurantees.ReportGuarantee),
  newKind(
    "GuaranteesExtrinsic",
    class GuaranteesExtrinsic extends Array {
      static Codec = gaurantees.guaranteesExtrinsicCodec;
    },
  ),
  newKind("Preimage", preimage.Preimage),
  newKind(
    "PreimageExtrinsic",
    class PreimageExtrinsic extends Array {
      static Codec = preimage.preimagesExtrinsicCodec;
    },
  ),
  newKind("RefineContext", refineContext.RefineContext),
  newKind("SignedTicket", tickets.SignedTicket),
  newKind("Ticket", tickets.Ticket),
  newKind(
    "TicketExtrinsic",
    class TicketExtrinsic extends Array {
      static Codec = tickets.ticketsExtrinsicCodec;
    },
  ),
  newKind("ImportSpec", workItem.ImportSpec),
  newKind("WorkItem", workItem.WorkItem),
  newKind("WorkItemExtrinsicSpec", workItem.WorkItemExtrinsicSpec),
  newKind("WorkPackage", workPackage.WorkPackage),
  newKind("WorkPackageSpec", workReport.WorkPackageSpec),
  newKind("WorkReport", workReport.WorkReport),
  newKind("WorkExecResult", workResult.WorkExecResult),
  newKind("WorkResult", workResult.WorkResult),
] as const;
