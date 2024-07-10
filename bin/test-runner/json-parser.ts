export type FromJson<T> =
	| FromJsonParser<T, string>
	| FromJsonParser<T, number>
	| FromJsonPrimitive<T>;

export type FromJsonPrimitive<T> = T extends string
	? "string"
	: T extends number
		? "number"
		: T extends boolean
			? "boolean"
			: T extends object
				? ObjectFromJson<T>
				: never;

export type FromJsonParser<T, Y> = [FromJsonPrimitive<Y>, (inJson: Y) => T];

export type ObjectFromJson<T> = {
	[K in keyof T]: FromJson<T[K]>;
};

export function parseFromJson<T>(jsonType: unknown, ctor: FromJson<T>): T {
	const t = typeof jsonType;

	if (ctor === "string") {
		if (t === "string") {
			return jsonType as T;
		}
		throw new Error(`Expected ${ctor} but got ${t}`);
	}

	if (ctor === "number") {
		if (t === "number") {
			return jsonType as T;
		}
		throw new Error(`Expected ${ctor} but got ${t}`);
	}

	if (ctor === "boolean") {
		if (t === "boolean") {
			return jsonType as T;
		}
		throw new Error(`Expected ${ctor} but got ${t}`);
	}

	if (Array.isArray(ctor)) {
		const type = ctor[0];
		if (type === "string") {
			const parser = ctor[1];
			const value = parseFromJson<string>(jsonType, type);
			return parser(value);
		}

		if (type === "number") {
			const parser = ctor[1];
			const value = parseFromJson<number>(jsonType, type);
			return parser(value);
		}

		throw new Error(`Invalid parser type: ${type}`);
	}

	if (t !== "object") {
		throw new Error(`Expected complex type but got ${t}`);
	}

	if (typeof ctor !== "object") {
		throw new Error(`Unhandled type ${ctor}`);
	}

	const obj = jsonType as { [key: string]: unknown };
	const c = ctor as { [key: string]: FromJson<unknown> };
	for (const key of Object.keys(ctor)) {
		const v = obj[key];
		obj[key] = parseFromJson(v, c[key]);
	}

	return obj as T;
}
