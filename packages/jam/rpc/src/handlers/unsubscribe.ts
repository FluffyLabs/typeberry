import type { GenericHandler, validation } from "@typeberry/rpc-validation";
import type z from "zod";

export const unsubscribe: GenericHandler<
  z.infer<typeof validation.unsubscribeSchema.input>,
  z.infer<typeof validation.unsubscribeSchema.output>
> = async ([id], { subscription }) => {
  return subscription.unsubscribe(id);
};
