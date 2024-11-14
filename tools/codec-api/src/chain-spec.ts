import { ChainSpec } from "@typeberry/config";

export const chainSpec = new ChainSpec({
  validatorsCount: 6,
  epochLength: 12,
  coresCount: 1,
  contestLength: 1,
  slotDuration: 1,
  ticketsPerValidator: 1,
});
