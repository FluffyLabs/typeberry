import type { JsonObject } from "@typeberry/block-json";
import { json } from "@typeberry/json-parser";

/** Block authorship options. */
export class AuthorshipOptions {
  static fromJson = json.object<JsonObject<AuthorshipOptions>, AuthorshipOptions>(
    {
      omit_seal_verification: "boolean",
    },
    AuthorshipOptions.new,
  );

  static new({ omit_seal_verification }: JsonObject<AuthorshipOptions>) {
    return new AuthorshipOptions(omit_seal_verification);
  }

  private constructor(
    /** Use fake seal verification instead of running bandersnatch. */
    public readonly omitSealVerification: boolean,
  ) {}
}
