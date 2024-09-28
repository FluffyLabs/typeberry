import { ARRAY, FROM_ANY, optional } from "../json-parser";

export class JsonSchema {
  static fromJson = optional<JsonSchema>(
    {
      $schema: "string",
      type: "string",
      title: "string",
      description: "string",
      properties: FROM_ANY(() => null),
      required: ARRAY("string"),
      additionalProperties: "boolean",
      $defs: FROM_ANY(() => null),
    },
    ["title", "description", "required", "$defs"],
  );
  $schema!: string;
  type!: string;
  title?: string;
  description?: string;
  properties!: unknown;
  required!: string[];
  additionalProperties!: boolean;
  $defs?: unknown;
}

export async function ignoreSchemaFiles(_testContent: JsonSchema) {
  // ignore schema files
}
