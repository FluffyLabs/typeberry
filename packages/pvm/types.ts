type Status = "trap";

export type MemoryChunkItem = {
	address: number;
	contents: Array<number>;
};

export type PageMapItem = {
	address: number;
	length: number;
	"is-writable": boolean;
};

export type Program = {
	c: Array<number>;
	k: Array<number>;
	jLength: number;
	z: number;
	cLength: number;
};
