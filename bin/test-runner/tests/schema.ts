import { ARRAY, FROM_ANY, type FromJson, OPTIONAL } from "../json-parser";

export class JsonSchema {
  static fromJson: FromJson<JsonSchema> = {
    $schema: "string",
    type: "string",
    title: OPTIONAL<string>("string"),
    description: OPTIONAL<string>("string"),
    properties: FROM_ANY(() => null),
    required: OPTIONAL<string[]>(ARRAY("string")),
    additionalProperties: "boolean",
    $defs: OPTIONAL(FROM_ANY(() => null)),
  };
  $schema!: string;
  type!: string;
  title?: string;
  description?: string;
  properties!: unknown;
  required?: string[];
  additionalProperties!: boolean;
  $defs?: unknown;
}

export async function ignoreSchemaFiles(_testContent: JsonSchema) {
  // ignore schema files
}
