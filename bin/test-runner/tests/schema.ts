import { ANY, ARRAY, BOOLEAN, type FromJson, OBJECT, OPTIONAL, STRING } from "../json-parser";

export class JsonSchema {
  static fromJson: FromJson<JsonSchema> = OBJECT({
    $schema: STRING(),
    type: STRING(),
    title: OPTIONAL<string>(STRING()),
    description: OPTIONAL<string>(STRING()),
    properties: ANY(() => null as unknown),
    required: OPTIONAL<string[]>(ARRAY(STRING())),
    additionalProperties: BOOLEAN(),
    $defs: OPTIONAL<unknown>(ANY(() => null as unknown)),
  });
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
