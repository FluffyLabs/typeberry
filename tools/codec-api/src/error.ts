export function createErrorResponse(title: string, detail: string) {
  return {
    errors: [{ title, detail }],
  };
}
