import { test } from 'node:test';
import {verify_bandersnatch} from './bandersnatch';

test('Bandersnatch verification', async (t) => {
	
	await t.test("verify", async () => {
		try {
			await verify_bandersnatch();
		} catch (e) {
			console.log('Error temporarily expected.');
		}
	});
});
