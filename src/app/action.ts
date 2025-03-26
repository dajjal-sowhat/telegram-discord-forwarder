'use server';

import {handleWatermark} from "../core/watermark";

export async function testWatermark(url: string) {
	return await handleWatermark(url).then(e=>e.toString('base64'))
}
