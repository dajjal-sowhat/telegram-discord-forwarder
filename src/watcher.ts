import * as chokidar from 'chokidar';
import * as Path from "node:path";


const watcher = chokidar.watch(['./src', '*'], { persistent: true });
console.log("WATCHER INIT");
watcher.on('change', (filePath) => {
	const nonReloadable = ['watcher.ts', 'instrumentation.ts'];
	if (nonReloadable.find(s => filePath.endsWith(s))) {
		console.log("Terminated cause of watcher change")
		process.exit(0);
	}

	if (filePath.endsWith('d.ts')) return;

	try {
		console.log(`File Change ${filePath}`)
		const resolvedPath = Path.resolve(process.cwd(), filePath);
		// Find and remove the module from the cache
		let [key] = Object.entries(require.cache).find(([k]) => k.endsWith(filePath) || k.endsWith(filePath.replaceAll("\\", "/"))) || [];
		if (!key) key = resolvedPath;
		if (require.cache[key]) {
			delete require.cache[key];
		}

		// Reload the module
		const newModule = require(key!);

		let called: string[] = [];
		Object.entries(require.cache).forEach(([cacheKey, module]) => {
			if (module?.exports?.unity_hotreload && !called.includes(cacheKey)) {
				console.log(`HOT RELOAD ${cacheKey.split("\\")?.slice(-2).join("/")}`)
				delete require.cache[cacheKey];
				const exports = require(cacheKey);
				exports.unity_hotreload?.();
				called.push(cacheKey);
			}
		});

		if (!called.includes(key) && newModule.unity_hotreload) {
			console.log(`HOT RELOAD Current Module ${key.split("\\")?.at(-1)}`)
			if (newModule.unity_hotreload) {
				newModule.unity_hotreload?.();
			}
		}
	} catch (e: any) {
		console.log(`FAIL TO APPLY CHANGE ON ${filePath}`,e?.message ?? e);
	}
});

require('./index')
require('./instrumentation').register();
