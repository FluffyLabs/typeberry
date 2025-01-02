export class ParsingArgsError extends Error {
  constructor() {
    super("Incorrect arguments length");
  }
}
