import type { JsonObject } from "@typeberry/block-json";
import { json } from "@typeberry/json-parser";

/** Block authorship options. */
export class AuthorshipOptions {
  static fromJson = json.object<JsonObject<AuthorshipOptions>, AuthorshipOptions>({}, AuthorshipOptions.new);

  static new() {
    return new AuthorshipOptions();
  }

  private constructor() {}
}
