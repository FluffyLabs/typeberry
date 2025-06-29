export function handleAsyncErrors(work: () => Promise<void>, onError: (e: unknown) => void) {
  return work().catch(onError);
}
