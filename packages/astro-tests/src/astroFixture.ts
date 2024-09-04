import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fastGlob from 'fast-glob';
import { Agent, request } from 'undici';
import { build, dev, preview, sync } from 'astro';
import type { AstroConfig, AstroInlineConfig } from 'astro';
import { mergeConfig } from '../node_modules/astro/dist/core/config/merge.js';
import { validateConfig } from '../node_modules/astro/dist/core/config/validate.js';
import type { App } from 'astro/app';
import { getViteConfig } from 'astro/config';
import { callsites } from './utils.js';

// Disable telemetry when running tests
process.env.ASTRO_TELEMETRY_DISABLED = 'true';

type InlineConfig = Omit<AstroInlineConfig, 'root'> & { root: string | URL };
export type NodeRequest = import('node:http').IncomingMessage;
export type NodeResponse = import('node:http').ServerResponse;
export type DevServer = Awaited<ReturnType<typeof dev>>;
export type PreviewServer = Awaited<ReturnType<typeof preview>>;

type Fixture = {
	/**
	 * Returns the final config.
	 * Will be automatically passed to the methods below:
	 * - .dev()
	 * - .build()
	 * - .preview()
	 * - .sync()
	 */
	config: AstroConfig;
	/**
	 * Starts a dev server at an available port. Be sure to call devServer.stop() before test exit.
	 */
	startDevServer: typeof dev;
	/**
	 * Builds into current folder (will erase previous build)
	 */
	build: typeof build;
	/**
	 * Starts a preview server. Note this can't be running in same fixture as .dev() as they share ports.
	 * Also, you must call `server.close()` before test exit.
	 */
	preview: typeof preview;
	sync: typeof sync;

	/**
	 * Removes the project's dist folder.
	 */
	clean: () => Promise<void>;
	resolveUrl: (url: string) => string;
	/**
	 * Returns a URL from the running server.
	 *
	 * Must have called .dev() or .preview() before.
	 */
	fetch: (url: string, opts?: Parameters<typeof request>[1]) => Promise<Response>;

	pathExists: (path: string) => boolean;
	/**
	 * Read a file from the build.
	 */
	readFile: (path: string) => Promise<string>;
	/**
	 * Edit a file in the fixture.
	 *
	 * The second parameter can be the new content of the file
	 * or a function that takes the current content and returns the new content.
	 *
	 * Returns a function that can be called to revert the edit.
	 */
	editFile: (path: string, updater: string | ((content: string) => string)) => Promise<() => void>;
	/**
	 * Reset all changes made with .editFile()
	 */
	resetAllFiles: () => void;
	/**
	 * Read a directory from the build.
	 */
	readdir: (path: string) => Promise<string[]>;

	/**
	 * Find entries in the build output matching the glob pattern.
	 */
	glob: (pattern: string) => Promise<string[]>;
	/**
	 * Load an app built using the Test Adapter.
	 */
	loadTestAdapterApp: () => Promise<App>;
	/**
	 * Load an app built using the Node Adapter.
	 */
	loadNodeAdapterHandler: () => Promise<(req: NodeRequest, res: NodeResponse) => void>;
};

/**
 * Loads an Astro fixture project.
 *
 * @example Using on a test suite:
 *   ```js
 *   let fixture = await loadFixture({
 *     root: './fixtures/astro-check-watch/',
 *   });
 *   ```
 */
export async function loadFixture(inlineConfig: InlineConfig): Promise<Fixture> {
	if (!inlineConfig?.root) throw new Error("Must provide { root: './fixtures/...' }");

	// Silent by default during tests to not pollute the console output
	inlineConfig.logLevel = 'silent';
	inlineConfig.vite ??= {};
	inlineConfig.vite.logLevel = 'silent';
	// Prevent hanging when testing the dev server on some scenarios
	inlineConfig.vite.optimizeDeps ??= {};
	inlineConfig.vite.optimizeDeps.noDiscovery = true;

	let root = inlineConfig.root;
	if (typeof root !== 'string') {
		// Handle URL, should already be absolute so just convert to path
		root = fileURLToPath(root);
	} else if (root.startsWith('file://')) {
		// Handle "file:///C:/Users/fred", convert to "C:/Users/fred"
		root = fileURLToPath(new URL(root));
	} else if (!path.isAbsolute(root)) {
		const [caller] = callsites().slice(1);
		let callerUrl = caller.getScriptNameOrSourceURL() || undefined;
		if (callerUrl?.startsWith('file:') === false) {
			callerUrl = pathToFileURL(callerUrl).toString();
		}
		// Handle "./fixtures/...", convert to absolute path relative to the caller of this function.
		root = fileURLToPath(new URL(root, callerUrl));
	}
	inlineConfig.root = root;
	const config = await validateConfig(inlineConfig, root, 'dev');
	const viteConfig = await getViteConfig(
		{},
		{ ...inlineConfig, root }
	)({
		command: 'serve',
		mode: 'dev',
	});
	const viteServerOptions = viteConfig.server!;
	const protocol = viteServerOptions.https ? 'https' : 'http';

	const resolveUrl = (url: string) =>
		`${protocol}://${viteServerOptions.host! || 'localhost'}:${viteServerOptions.port}${url.replace(
			/^\/?/,
			'/'
		)}`;

	// A map of files that have been edited.
	let fileEdits = new Map();

	const resetAllFiles = () => {
		for (const [, reset] of fileEdits) {
			reset();
		}
		fileEdits.clear();
	};

	let fixtureId = new Date().valueOf();
	let devServer: DevServer;

	const onNextChange = () =>
		devServer
			? new Promise((resolve) => devServer.watcher.once('change', resolve))
			: Promise.reject(new Error('No dev server running'));

	// Also do it on process exit, just in case.
	process.on('exit', resetAllFiles);

	return {
		config,
		startDevServer: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'development';
			devServer = await dev(
				mergeConfig(inlineConfig, {
					...extraInlineConfig,
					force: true,
				})
			);
			viteServerOptions.host = parseAddressToHost(devServer.address.address)!; // update host
			viteServerOptions.port = devServer.address.port; // update port
			return devServer;
		},
		build: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'production';
			return build(
				mergeConfig(inlineConfig, extraInlineConfig),
				// @ts-expect-error -- This is not typed by Astro
				{ teardownCompiler: false }
			);
		},
		preview: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'production';
			const previewServer = await preview(mergeConfig(inlineConfig, extraInlineConfig));
			viteServerOptions.host = parseAddressToHost(previewServer.host)!; // update host
			viteServerOptions.port = previewServer.port; // update port
			return previewServer;
		},
		sync,

		clean: async () => {
			await fs.promises.rm(config.outDir, {
				maxRetries: 10,
				recursive: true,
				force: true,
			});
			const astroCache = new URL('./node_modules/.astro', config.root);
			if (fs.existsSync(astroCache)) {
				await fs.promises.rm(astroCache, {
					maxRetries: 10,
					recursive: true,
					force: true,
				});
			}
		},
		resolveUrl,
		fetch: async (url, init) => {
			if (config.vite?.server?.https) {
				init = {
					// Use a custom fetch dispatcher. This is an undici option that allows
					// us to customize the fetch behavior. We use it here to allow h2.
					dispatcher: new Agent({
						connect: {
							// We disable cert validation because we're using self-signed certs
							rejectUnauthorized: false,
						},
						// Enable HTTP/2 support
						allowH2: true,
					}),
					...init,
				};
			}
			const resolvedUrl = resolveUrl(url);
			try {
				return await request(resolvedUrl, init).then(async (res) => {
					const blob = await res.body.blob();
					const headers = new Headers();
					for (const [key, value] of Object.entries(res.headers)) {
						if (Array.isArray(value)) {
							value.forEach((v) => headers.append(key, v));
						} else if (value) {
							headers.append(key, value);
						}
					}

					return new Response(await blob.arrayBuffer(), {
						headers,
						status: res.statusCode,
					});
				});
			} catch (err: any) {
				// node fetch throws a vague error when it fails, so we log the url here to easily debug it
				if (err.message?.includes('fetch failed')) {
					console.error(`[astro test] failed to fetch ${resolvedUrl}`);
					console.error(err);
				}
				throw err;
			}
		},

		pathExists: (p) => fs.existsSync(new URL(p.replace(/^\//, ''), config.outDir)),
		readFile: (filePath) =>
			fs.promises.readFile(new URL(filePath.replace(/^\//, ''), config.outDir), 'utf8'),
		editFile: async (filePath, newContentsOrCallback) => {
			const fileUrl = new URL(filePath.replace(/^\//, ''), config.root);
			const contents = await fs.promises.readFile(fileUrl, 'utf-8');
			const reset = () => {
				fs.writeFileSync(fileUrl, contents);
			};
			// Only save this reset if not already in the map, in case multiple edits happen
			// to the same file.
			if (!fileEdits.has(fileUrl.toString())) {
				fileEdits.set(fileUrl.toString(), reset);
			}
			const newContents =
				typeof newContentsOrCallback === 'function'
					? newContentsOrCallback(contents)
					: newContentsOrCallback;
			const nextChange = devServer ? onNextChange() : Promise.resolve();
			await fs.promises.writeFile(fileUrl, newContents);
			await nextChange;
			return reset;
		},
		readdir: (fp) => fs.promises.readdir(new URL(fp.replace(/^\//, ''), config.outDir)),

		glob: (p) =>
			fastGlob(p, {
				cwd: fileURLToPath(config.outDir),
			}),
		loadTestAdapterApp: async () => {
			const url = new URL(`./server/entry.mjs?id=${fixtureId}`, config.outDir);
			const { createApp, manifest } = await import(url.toString());
			const app = createApp();
			app.manifest = manifest;
			return app;
		},
		loadNodeAdapterHandler: async () => {
			const url = new URL(`./server/entry.mjs?id=${fixtureId}`, config.outDir);
			const { handler } = await import(url.toString());
			return handler;
		},
		resetAllFiles,
	};
}

function parseAddressToHost(address?: string) {
	if (address?.startsWith('::')) {
		return `[${address}]`;
	}
	return address;
}
