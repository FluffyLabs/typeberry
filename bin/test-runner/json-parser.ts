
export type FromJson<T> = 
	T extends string ? 'string' :
	T extends number ? 'number' :
	T extends boolean ? 'boolean':
	T extends object ? ObjectFromJson<T> :
	null;

export type ObjectFromJson<T> = {
	[K in keyof T]: FromJson<T[K]>;
};

export function parseFromJson<T>(jsonType: unknown, ctor: FromJson<T>): T {
	const t = typeof jsonType;
	
	if (ctor === null) {
		if (jsonType === null) {
			return null as T;
		}
		throw new Error(`Expected ${ctor} but got ${t}`);
	}

	if (ctor === 'string') {
		if (t === 'string') {
			return jsonType as T;
		}
		throw new Error(`Expected ${ctor} but got ${t}`);
	}

	if (ctor === 'number') {
		if (t === 'number') {
			return jsonType as T;
		}
		throw new Error(`Expected ${ctor} but got ${t}`);
	}

	if (ctor === 'boolean') {
		if (t === 'boolean') {
			return jsonType as T;
		}
		throw new Error(`Expected ${ctor} but got ${t}`);
	}
	
	if (t !== 'object') {
		throw new Error(`Expected complex type but got ${t}`);
	}

	if (typeof ctor !== 'object') {
		throw new Error(`Unhandled type ${ctor}`);
	}

	const obj = jsonType as any;
	const c = ctor as any;
	for (const key of Object.keys(ctor)) {
		const v = obj[key];
		obj[key] = parseFromJson(v, c[key]);
	}

	return obj;
}
