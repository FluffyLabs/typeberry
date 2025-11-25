import type z from "zod";
import type { GenericHandler } from "../types.js";
import type { validation } from "../validation.js";

export const unsubscribe: GenericHandler<
  z.infer<typeof validation.unsubscribeSchema.input>,
  z.infer<typeof validation.unsubscribeSchema.output>
> = async ([id], { subscription }) => {
  return subscription.unsubscribe(id);
};
