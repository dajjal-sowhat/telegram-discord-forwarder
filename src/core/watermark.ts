import prisma from "../prisma/PrismaClient";
import * as fs from "fs";
import sharp from "sharp";

let _cache: {
	[k: string]: {
		created_at: Date,
		buffer: Buffer
	}
} = {}

export async function handleWatermark(url: string) {
	const cache = _cache[url];

	if (cache) {
		const ex = new Date(cache.created_at);
		ex.setMinutes(ex.getMinutes() + 15);
		if (ex.getTime() > Date.now()) return cache.buffer;
	}

	const [watermarkPath, watermarkX, watermarkOpacity] = await Promise.all([
		prisma.config.findUnique({
			where: {key: "watermarkPath"},
		}).then(e => e?.value),
		prisma.config.findUnique({
			where: {key: "watermarkX"}
		}).then(e => +(e?.value || "1")),
		prisma.config.findUnique({
			where: {key: "watermarkOpacity"}
		}).then(e => +(e?.value || "100"))
	])

	if (!watermarkPath || !fs.existsSync(watermarkPath)) {
		return await tryFetch(url).then(async e => Buffer.from(await e.arrayBuffer()));
	}

	const logoBuffer = watermarkPath.startsWith("http") ? await tryFetch(watermarkPath).then(async e => Buffer.from(await e.arrayBuffer())) : fs.readFileSync(watermarkPath);
	const imageBuffer = await tryFetch(url).then(async e => Buffer.from(await e.arrayBuffer()));

	const image = sharp(imageBuffer);
	const {width: imageWidth, height: imageHeight} = await image.metadata();

	if (!imageWidth || !imageHeight) {
		throw new Error('Unable to retrieve image dimensions');
	}

	const watermarkPercent = 10;
	const targetSize = Math.round(((imageHeight / 100 * watermarkPercent) + (imageWidth / 100 * watermarkPercent)) / 2 * Math.min(10,Math.max(0.1,watermarkX)));
	const defaultLogo = sharp(logoBuffer);
	const {width: logoOriginalWidth, height: logoOriginalHeight,hasAlpha} = await defaultLogo.metadata();

	if (!logoOriginalWidth || !logoOriginalHeight) {
		throw new Error('Unable to retrieve logo dimensions');
	}

	// Calculate aspect-ratio based resize
	const aspectRatio = logoOriginalWidth / logoOriginalHeight;
	let logoWidth, logoHeight;
	if (logoOriginalWidth > logoOriginalHeight) {
		logoWidth = targetSize;
		logoHeight = Math.round(targetSize / aspectRatio);
	} else {
		logoHeight = targetSize;
		logoWidth = Math.round(targetSize * aspectRatio);
	}

	const bg = {r: 0, g: 0, b: 0, alpha: 0}

	const alphaLogo = hasAlpha ? defaultLogo:defaultLogo.png({progressive:true}).flatten({background:bg});
	const logo = alphaLogo
		.ensureAlpha(Math.min(1,Math.max(watermarkOpacity / 100,0)))
		.resize({
			width: logoWidth,
			height: logoHeight,
			fit: "contain"
		});


	const randomNumber = Math.round(Math.random() * availablePositions.length);
	const cornerPosition = availablePositions[Math.max(0, randomNumber) % availablePositions.length];


	const position = calculateCornerPosition(imageWidth, imageHeight, logoWidth, logoHeight, cornerPosition);
	const final = await image
		.flatten({background: bg})
		.ensureAlpha(0.1)
		.composite(
			[{input: await logo.toBuffer(), top: position.top, left: position.left,}]
		)
		.toBuffer();
	_cache[url] = {
		created_at: new Date(),
		buffer: final
	}
	setTimeout(optimizeCache);
	return final;
}

const availablePositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

function calculateCornerPosition(
	imageWidth: number,
	imageHeight: number,
	logoWidth: number,
	logoHeight: number,
	cornerPosition: typeof availablePositions[number]
): { top: number; left: number } {
	const margin = Math.min(Math.floor((imageWidth / 100) * 2.5), 30); // Margin from the edge
	const positions = {
		'top-left': {top: margin, left: margin},
		'top-right': {top: margin, left: imageWidth - logoWidth - margin},
		'bottom-left': {top: imageHeight - logoHeight - margin, left: margin},
		'bottom-right': {top: imageHeight - logoHeight - margin, left: imageWidth - logoWidth - margin},
	};

	return positions[cornerPosition];
}

async function tryFetch(url: string, init: RequestInit = {}, _try = 0, lastResponse?: Response) {
	if (_try > 5) throw (`FAIL TO FETCH ${lastResponse?.statusText}`);
	let res: typeof lastResponse;
	try {
		res = await fetch(url, init);
		return res;
	} catch {
		console.error(`Trying to fetch(${_try + 1}) ${url}...`)
		return await tryFetch(url, init, _try + 1, res);
	}
}

function optimizeCache() {
	_cache = Object.fromEntries(
		Object.entries(_cache).map(([key, cache]) => {
			const ex = new Date(cache.created_at);
			ex.setMinutes(ex.getMinutes() + 15);

			if (ex.getTime() < Date.now()) return undefined;

			return [key, cache];
		}).filter(o => !!o)
	)
}
