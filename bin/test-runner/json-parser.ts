/// Extract an element type of an array type.
export type FromJson<T> = T extends (infer U)[]
	? ["array", FromJson<U>]
	: // parse a string from JSON into expected type
			| FromJsonWithParser<T, string>
			// parse a number from JSON into expected type
			| FromJsonWithParser<T, number>
			// manually parse a nested object
			| FromJsonWithParser<T, unknown>
			| FromJsonPrimitive<T>;

export type FromJsonPrimitive<T> = T extends string
	? "string"
	: T extends number
		? "number"
		: T extends boolean
			? "boolean"
			: T extends object
				? ObjectFromJson<T>
				: T extends unknown
					? "object"
					: never;

export type FromJsonWithParser<T, Y> = [
	FromJsonPrimitive<Y>,
	(inJson: Y, context?: string) => T,
];

export type ObjectFromJson<T> = {
	[K in keyof T]: FromJson<T[K]>;
};

export function optional<T>(
	type: ObjectFromJson<T>,
): FromJsonWithParser<T, unknown> {
	return [
		"object",
		(json: unknown, context?: string) => {
			if (json === null || typeof json !== "object") {
				throw new Error(
					`[${context}] Expected object with optional fields, got: ${json}`,
				);
			}

			const j = json as { [key: string]: unknown };
			for (const [k, v] of Object.entries(type)) {
				if (k in json) {
					// we allow `null` in a key
					if (j[k] !== null) {
						const val = v as FromJson<unknown>;
						j[k] = parseFromJson(j[k], val, `${context}.${k}`);
					}
				}
			}

			return json as T;
		},
	];
}

export function parseFromJson<T>(
	jsonType: unknown,
	ctor: FromJson<T>,
	context = "<root>",
): T {
	const t = typeof jsonType;

	if (ctor === "string") {
		if (t === "string") {
			return jsonType as T;
		}
		throw new Error(`[${context}] Expected ${ctor} but got ${t}`);
	}

	if (ctor === "number") {
		if (t === "number") {
			return jsonType as T;
		}
		throw new Error(`[${context}] Expected ${ctor} but got ${t}`);
	}

	if (ctor === "boolean") {
		if (t === "boolean") {
			return jsonType as T;
		}
		throw new Error(`[${context}] Expected ${ctor} but got ${t}`);
	}

	if (Array.isArray(ctor)) {
		const type = ctor[0];

		// an array type
		if (type === "array") {
			const expectedType = ctor[1];
			if (!Array.isArray(jsonType)) {
				throw new Error(`[${context}] Expected array, got ${jsonType}`);
			}

			const arr = jsonType as Array<unknown>;
			for (const [k, v] of arr.entries()) {
				arr[k] = parseFromJson(v, expectedType, `${context}.${k}`);
			}
			return arr as T;
		}

		// a manual parser for nested object
		if (type === "object") {
			const parser = ctor[1];
			const obj = jsonType as object;
			return parser(obj, context);
		}

		// An expected in-json type and the parser to the destination type.
		if (type === "string") {
			const parser = ctor[1];
			const value = parseFromJson<string>(jsonType, type, context);
			return parser(value, context);
		}

		if (type === "number") {
			const type = ctor[0];
			const parser = ctor[1];
			const value = parseFromJson<number>(jsonType, type, context);
			return parser(value, context);
		}

		throw new Error(`[${context}] Invalid parser type: ${type}`);
	}

	if (t !== "object") {
		throw new Error(`Expected complex type but got ${t}`);
	}

	if (typeof ctor !== "object") {
		throw new Error(`[${context}] Unhandled type ${ctor}`);
	}

	if (jsonType === null) {
		throw new Error(`[${context}] Unexpected 'null'`);
	}

	const obj = jsonType as { [key: string]: unknown };
	const c = ctor as { [key: string]: FromJson<unknown> };

	const keysDifference = diffKeys(obj, ctor);
	if (keysDifference.length > 0) {
		throw new Error(
			`[${context}] Unexpected or missing keys: ${keysDifference.join(" | ")} ${JSON.stringify(obj)} ${JSON.stringify(ctor)}`,
		);
	}

	for (const key of Object.keys(ctor)) {
		const v = obj[key];
		obj[key] = parseFromJson(v, c[key], `${context}.${key}`);
	}

	return obj as T;
}

function diffKeys(obj1: object, obj2: object): [string, string][] {
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	keys1.sort();
	keys2.sort();

	const keysCounter: { [key: string]: number } = {};
	const max = Math.max(keys2.length, keys2.length);

	const KEY1_SET = 1;
	const KEY2_SET = 2;

	for (let i = 0; i < max; i++) {
		keysCounter[keys1[i]] = (keysCounter[keys1[i]] || 0) + KEY1_SET;
		keysCounter[keys2[i]] = (keysCounter[keys2[i]] || 0) + KEY2_SET;
	}

	const diff: [string, string][] = [];
	const id = (v?: string) => (v ? `"${v}"` : "<missing>");
	for (const [k, v] of Object.entries(keysCounter)) {
		if (v !== KEY1_SET + KEY2_SET && k !== "undefined") {
			diff.push(
				v === KEY1_SET ? [id(k), id(undefined)] : [id(undefined), id(k)],
			);
		}
	}

	return diff;
}
