import type { U16, U32, U64 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";

export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;
export type ServiceId = Opaque<U32, "ServiceId[u32]">;
export type Gas = Opaque<U64, "Gas[u64]">;
