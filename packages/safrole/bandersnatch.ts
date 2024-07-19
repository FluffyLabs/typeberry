import {verify_safrole} from "bandersnatch-wasm/pkg";

export async function verify_bandersnatch(): Promise<boolean> {
	// TODO [ToDr] make it async (run inside a worker)
	return verify_safrole();
}
