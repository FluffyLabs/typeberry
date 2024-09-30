import { type FromJson, json } from "@typeberry/json-parser";

export class JsonSchema {
  static fromJson: FromJson<JsonSchema> = {
    $schema: "string",
    type: "string",
    title: json.optional("string"),
    description: json.optional("string"),
    properties: json.fromAny(() => null),
    required: json.optional<string[]>(json.array("string")),
    additionalProperties: "boolean",
    $defs: json.optional(json.fromAny(() => null)),
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
