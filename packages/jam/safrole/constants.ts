import { BytesBlob } from "@typeberry/bytes";

/** `X_E`: https://graypaper.fluffylabs.dev/#/68eaa1f/0e90010e9001?v=0.6.4 */
export const JAM_ENTROPY = BytesBlob.blobFromString("jam_entropy").raw;
/** `X_F`: https://graypaper.fluffylabs.dev/#/68eaa1f/0ea5010ea501?v=0.6.4 */
export const JAM_FALLBACK_SEAL = BytesBlob.blobFromString("jam_fallback_seal").raw;
/** `X_T`: https://graypaper.fluffylabs.dev/#/68eaa1f/0ebc010ebc01?v=0.6.4 */
export const JAM_TICKET_SEAL = BytesBlob.blobFromString("jam_ticket_seal").raw;
