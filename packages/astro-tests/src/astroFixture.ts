import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fastGlob from 'fast-glob';
import { Agent, request } from 'undici';
import { build, dev, preview, sync } from 'astro';
import type { AstroConfig, AstroInlineConfig } from 'astro';
import { getViteConfig, mergeConfig, validateConfig } from 'astro/config';
import { callsites } from './utils.js';
import type { App } from 'astro/app';
import { getDebug } from './internal/log.js';
import { setNestedIfNullish } from '@inox-tools/utils/values';

const debug = getDebug('fixture');

// Disable telemetry when running tests
process.env.ASTRO_TELEMETRY_DISABLED = 'true';

type InlineConfig = Omit<AstroInlineConfig, 'root'> & {
	root: string | URL;
	ci?: boolean;
};
export type NodeRequest = import('node:http').IncomingMessage;
export type NodeResponse = import('node:http').ServerResponse;
export type DevServer = Awaited<ReturnType<typeof dev>>;
export type PreviewServer = Awaited<ReturnType<typeof preview>>;

export type TestApp = {
	render: (req: Request) => Promise<Response>;
	toInternalApp: () => App;
};

type Fixture = {
	/**
	 * Returns the final config.
	 * Will be automatically passed to the methods below:
	 * - .startDevServer()
	 * - .build()
	 * - .preview()
	 * - .sync()
	 */
	config: AstroConfig;
	/**
	 * Starts a dev server at an available port.
	 *
	 * This server can't be running at the same time for thein same fixture as .preview() since they share ports.
	 * Be sure to call devServer.stop() before test exit.
	 *
	 * Equivalent to running `astro dev`.
	 */
	startDevServer: typeof dev;
	/**
	 * Builds into current folder (will erase previous build).
	 *
	 * Equivalent to running `astro build`.
	 */
	build: typeof build;
	/**
	 * Starts a preview server.
	 *
	 * This server can't be running at the same time for thein same fixture as .dev() since they share ports.
	 * Be sure to call server.stop() before test exit.
	 *
	 * Equivalent to running `astro preview`.
	 */
	preview: typeof preview;
	/**
	 * Synchronizes the Astro project and configuration with the generated code, populating the `src/env.d.ts` file and the `.astro` directory.
	 *
	 * Equivalent to running `astro sync`.
	 */
	sync: typeof sync;

	/**
	 * Removes generated directories from the fixture directory.
	 */
	clean: () => Promise<void>;
	/**
	 * Resolves a relative URL to the full url of the running server.
	 *
	 * This can only be called after either .startDevServer() or .preview() is called.
	 */
	resolveUrl: (url: string) => string;
	/**
	 * Send a request to the given URL. If the URL is relative, it will be resolved relative to the root of the server (without a base path).
	 *
	 * This can only be called after either .startDevServer() or .preview() is called.
	 */
	fetch: (url: string, opts?: Parameters<typeof request>[1]) => Promise<Response>;

	/**
	 * Checks whether the given path exists on the build output.
	 */
	pathExists: (path: string) => boolean;
	/**
	 * Read a file (as a string) from the build. Do NOT use this for binary files (e.g. images).
	 *
	 * Returns null if the file doesn't exist.
	 */
	readFile: (path: string, encoding?: BufferEncoding) => Promise<string | null>;
	/**
	 * Read a file (as a buffer) from the build. DO use this for binary files (e.g. images).
	 *
	 * Returns null if the file doesn't exist.
	 */
	readFileAsBuffer: (path: string) => Promise<Buffer | null>;
	/**
	 * Read a file (as a string) from the project. Do NOT use this for binary files (e.g. images).
	 *
	 * Returns null if the file doesn't exist.
	 */
	readSrcFile: (path: string, encoding?: BufferEncoding) => Promise<string | null>;
	/**
	 * Read a file (as a buffer) from the project. DO use this for binary files (e.g. images).
	 *
	 * Returns null if the file doesn't exist.
	 */
	readSrcFileAsBuffer: (path: string) => Promise<Buffer | null>;
	/**
	 * Edit a file in the fixture.
	 *
	 * The second parameter can be the new content of the file
	 * or a function that takes the current content and returns the new content.
	 *
	 * The content passed to the function will be null if the file doesn't exist.
	 * If the returned content is null, the file will be deleted.
	 *
	 * Returns a function that can be called to revert the edit.
	 */
	editFile: (
		path: string,
		updater: string | null | ((content: string | null) => string | null)
	) => Promise<() => void>;
	/**
	 * Reset all changes made with .editFile()
	 */
	resetAllFiles: () => void;
	/**
	 * Read a directory from the build output.
	 */
	readdir: (path: string) => Promise<string[]>;

	/**
	 * Find entries in the build output matching the glob pattern.
	 */
	glob: (pattern: string) => Promise<string[]>;
	/**
	 * Load an app built using the Test Adapter.
	 */
	loadTestAdapterApp: () => Promise<TestApp>;
	/**
	 * Load the handler for an app built using the Node Adapter.
	 */
	loadNodeAdapterHandler: () => Promise<(req: NodeRequest, res: NodeResponse) => void>;
};

// Select a random default port
let nextDefaultPort = 10000 + Math.floor(Math.random() * 40000);

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
export async function loadFixture({ root, ci = false, ...remaining }: InlineConfig): Promise<Fixture> {
	if (!root) throw new Error("Must provide { root: './fixtures/...' }");
	const inlineConfig: AstroInlineConfig = remaining;

	debug('Setting default log level to "silent"');
	// Silent by default during tests to not pollute the console output
	setNestedIfNullish(inlineConfig, 'logLevel', 'silent');
	setNestedIfNullish(inlineConfig, 'vite.logLevel', 'silent');
	setNestedIfNullish(inlineConfig, 'devToolbar.enabled', false);

	debug('Disabling Vite discovery for dependency optimization');
	// Prevent hanging when testing the dev server on some scenarios
	setNestedIfNullish(inlineConfig, 'vite.optimizeDeps.noDiscovery', true);

	inlineConfig.server ??= {};
	if (typeof inlineConfig.server === 'function') {
		debug('Wrapping server config for default port');
		const original = inlineConfig.server;
		inlineConfig.server = (options) => ({
			port: nextDefaultPort++,
			...original(options),
		});
	} else {
		inlineConfig.server.port ??= nextDefaultPort++;
	}

	if (typeof root !== 'string') {
		// Handle URL, should already be absolute so just convert to path
		inlineConfig.root = fileURLToPath(root);
	} else if (root.startsWith('file://')) {
		debug('Root is a file URL, converting to path');
		// Handle "file:///C:/Users/fred", convert to "C:/Users/fred"
		inlineConfig.root = fileURLToPath(new URL(root));
	} else if (!path.isAbsolute(root)) {
		debug('Root is a relative path, resolving to absolute path relative to caller');
		const [caller] = callsites().slice(1);
		let callerUrl = caller.getScriptNameOrSourceURL() || undefined;
		if (callerUrl?.startsWith('file:') === false) {
			callerUrl = pathToFileURL(callerUrl).toString();
		}
		debug(`Fixture loaded from ${callerUrl}`);
		// Handle "./fixtures/...", convert to absolute path relative to the caller of this function.
		inlineConfig.root = fileURLToPath(new URL(root, callerUrl));
		debug(`Resolved fixture root to ${root}`);
	} else {
		inlineConfig.root = root;
	}

	const config = await validateConfig(inlineConfig, inlineConfig.root, 'dev');

	debug('Output dir:', config.outDir);
	debug('Src dir:', config.srcDir);

	const viteConfig = await getViteConfig(
		{},
		inlineConfig
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
			? new Promise<void>((resolve) =>
					// TODO: Implement filter to only resolve on changes to a given file.
					devServer.watcher.once('change', () => resolve())
				)
			: Promise.reject(new Error('No dev server running'));

	// Also do it on process exit, just in case.
	process.on('exit', resetAllFiles);

	const resolveOutPath = (path: string) => new URL(path.replace(/^\//, ''), config.outDir);
	const resolveProjectPath = (path: string) => new URL(path.replace(/^\//, ''), config.root);

	return {
		config,
		startDevServer: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'development';
			debug(`Starting dev server for fixture ${root}`);
			devServer = await dev(
				mergeConfig(inlineConfig, {
					...extraInlineConfig,
					force: true,
				})
			);
			viteServerOptions.host = parseAddressToHost(devServer.address.address)!;
			viteServerOptions.port = devServer.address.port;
			debug(`Dev server for ${root} running at ${resolveUrl('/')}`);
			return devServer;
		},
    build: async (extraInlineConfig = {}) => {
      process.env.NODE_ENV = 'production';
      debug(`Building fixture ${root}`);
      
      if (ci) {
        const { execSync } = await import('node:child_process');
        
				debug('Using CLI build for CI environment');
				execSync('astro build', {
					cwd: inlineConfig.root,
					env: { ...process.env, NODE_ENV: 'production' },
					stdio: 'inherit'
				});
      } else { 
				debug('Using programmatic build');
				return build(mergeConfig(inlineConfig, extraInlineConfig));
			}
    },
		preview: async (extraInlineConfig = {}) => {
			process.env.NODE_ENV = 'production';
			debug(`Starting preview server for fixture ${root}`);
			const previewServer = await preview(mergeConfig(inlineConfig, extraInlineConfig));
			viteServerOptions.host = parseAddressToHost(previewServer.host)!;
			viteServerOptions.port = previewServer.port;
			debug(`Preview server for ${root} running at ${resolveUrl('/')}`);
			return previewServer;
		},
		sync,

		clean: async () => {
			debug(`Cleaning fixture ${root}`);
			debug(`Removing outDir`);
			await fs.promises.rm(config.outDir, {
				maxRetries: 10,
				recursive: true,
				force: true,
			});

			debug(`Removing node_modules/.astro`);
			await fs.promises.rm(resolveProjectPath('./node_modules/.astro'), {
				maxRetries: 10,
				recursive: true,
				force: true,
			});

			debug(`Removing cacheDir`);
			await fs.promises.rm(config.cacheDir, {
				maxRetries: 10,
				recursive: true,
				force: true,
			});

			debug(`Removing .astro`);
			await fs.promises.rm(resolveProjectPath('./.astro'), {
				maxRetries: 10,
				recursive: true,
				force: true,
			});
		},
		resolveUrl,
		fetch: async (url, init) => {
			if (config.vite?.server?.https) {
				debug('Injecting agent to enable HTTPS and HTTP/2 support');
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
					console.error(`[astro-tests] failed to fetch ${resolvedUrl}`);
					console.error(err);
				}
				throw err;
			}
		},

		pathExists: (p) => fs.existsSync(resolveOutPath(p)),
		readFile: async (filePath, encoding = 'utf8') => {
			const path = resolveOutPath(filePath);

			if (!fs.existsSync(path)) {
				return null;
			}

			return fs.promises.readFile(path, encoding);
		},
		readFileAsBuffer: async (filePath) => {
			const path = resolveOutPath(filePath);

			if (!fs.existsSync(path)) {
				return null;
			}

			return fs.promises.readFile(path);
		},
		readSrcFile: async (filePath, encoding = 'utf8') => {
			const path = resolveProjectPath(filePath);

			if (!fs.existsSync(path)) {
				return null;
			}

			return fs.promises.readFile(path, encoding);
		},
		readSrcFileAsBuffer: async (filePath) => {
			const path = resolveProjectPath(filePath);

			if (!fs.existsSync(path)) {
				return null;
			}

			return fs.promises.readFile(path);
		},
		editFile: async (filePath, newContentsOrCallback) => {
			const fileUrl = resolveProjectPath(filePath);

			const contents = fs.existsSync(fileUrl) ? await fs.promises.readFile(fileUrl, 'utf-8') : null;

			const reset = () => {
				debug(`Resetting ${filePath}`);
				if (contents) {
					fs.writeFileSync(fileUrl, contents);
				} else {
					fs.rmSync(fileUrl, { force: true });
				}
			};

			// Only save this reset if not already in the map, in case multiple edits happen
			// to the same file.
			if (!fileEdits.has(fileUrl.toString())) {
				fileEdits.set(fileUrl.toString(), reset);
			}

			debug(`Editing ${filePath}`);

			const newContents =
				typeof newContentsOrCallback === 'function'
					? newContentsOrCallback(contents)
					: newContentsOrCallback;

			const nextChange = devServer ? onNextChange() : Promise.resolve();

			if (newContents) {
				await fs.promises.mkdir(path.dirname(fileURLToPath(fileUrl)), { recursive: true });
				await fs.promises.writeFile(fileUrl, newContents);
			} else {
				await fs.promises.rm(fileUrl, { force: true });
			}

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
			debug(`Importing test adapter entrypoint from ${url.toString()}`);
			const { createApp, manifest } = await import(url.toString());
			debug('Instantiating test adapter app');
			const app = createApp();
			debug('Manifest:', manifest);
			app.manifest = manifest;
			return {
				render: (req) => app.render(req),
				toInternalApp: () => app,
			};
		},
		loadNodeAdapterHandler: async () => {
			const url = new URL(`./server/entry.mjs?id=${fixtureId}`, config.outDir);
			debug(`Importing node adapter handler from ${url.toString()}`);
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
