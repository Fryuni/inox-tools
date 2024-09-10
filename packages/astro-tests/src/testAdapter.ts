/**
 * Copied from: https://github.com/withastro/astro/blob/d2574ad8932039f3eea3bd6d9368bec377a0c334/packages/astro/test/test-adapter.js
 * Modified to use TypeScript and to comply with new types and requirements.
 */

import type { AstroIntegration, HookParameters } from 'astro';

type EntryPoints = HookParameters<'astro:build:ssr'>['entryPoints'];
type MiddlewareEntryPoint = HookParameters<'astro:build:ssr'>['middlewareEntryPoint'];
type Routes = HookParameters<'astro:build:done'>['routes'];

export type Options = {
	/**
	 * Environment variables available for `astro:env` as server-side variables and secrets.
	 */
	env?: Record<string, string | undefined>;
	/**
	 * Whether to expose `Astro.clientAddress`.
	 *
	 * @default true
	 */
	provideAddress?: boolean;

	/**
	 * Callback to collect the build entrypoints.
	 *
	 * The collected value is a map from `RouteData` describing a route
	 * to the URL pointing to the file on disk that can be imported to
	 * render that route.
	 */
	setEntryPoints?: (entryPoints: EntryPoints) => void;
	/**
	 * Callback to collect the middleware entrypoint.
	 *
	 * The collected value is the URL pointing to the file on disk.
	 * It will be `undefined` if no middleware is used.
	 */
	setMiddlewareEntryPoint?: (middlewareEntryPoint: MiddlewareEntryPoint) => void;
	/**
	 * Callback to collect the final state of the routes.
	 */
	setRoutes?: (routes: Routes) => void;
};

export default function (options: Options = {}): AstroIntegration {
	const {
		env,
		provideAddress = true,
		setEntryPoints,
		setMiddlewareEntryPoint,
		setRoutes,
	} = options;

	return {
		name: 'test-ssr-adapter',
		hooks: {
			'astro:config:setup': ({ updateConfig }) => {
				updateConfig({
					vite: {
						plugins: [
							{
								name: 'test-ssr-adapter',
								resolveId(id) {
									if (id === '@my-ssr') {
										return id;
									}
								},
								load(id) {
									if (id === '@my-ssr') {
										return `
											import { App } from 'astro/app';
											import fs from 'fs';

											${
												env != null
													? `
											const $$env = ${JSON.stringify(env)};
											await import('astro/env/setup')
												.then(mod => mod.setGetEnv((key) => $$env[key]))
												.catch(() => {});`
													: ''
											}

											class MyApp extends App {
												#manifest = null;
												constructor(manifest, streaming) {
													super(manifest, streaming);
													this.#manifest = manifest;
												}

												async render(request, { routeData, clientAddress, locals, addCookieHeader } = {}) {
													const url = new URL(request.url);
													if(this.#manifest.assets.has(url.pathname)) {
														const filePath = new URL('../../client/' + this.removeBase(url.pathname), import.meta.url);
														const data = await fs.promises.readFile(filePath);
														return new Response(data);
													}

													${provideAddress ? `request[Symbol.for('astro.clientAddress')] = clientAddress ?? '0.0.0.0';` : ''}
													return super.render(request, { routeData, locals, addCookieHeader });
												}
											}

											export function createExports(manifest) {
												return {
													manifest,
													createApp: (streaming) => new MyApp(manifest, streaming)
												};
											}
										`;
									}
								},
							},
						],
					},
				});
			},
			'astro:config:done': ({ setAdapter }) => {
				setAdapter({
					name: 'my-ssr-adapter',
					serverEntrypoint: '@my-ssr',
					exports: ['manifest', 'createApp'],
					supportedAstroFeatures: {
						serverOutput: 'stable',
						envGetSecret: 'stable',
						staticOutput: 'stable',
						hybridOutput: 'stable',
						i18nDomains: 'stable',
						assets: {
							supportKind: 'stable',
							isSharpCompatible: true,
							isSquooshCompatible: true,
						},
					},
				});
			},
			'astro:build:ssr': ({ entryPoints, middlewareEntryPoint }) => {
				if (setEntryPoints) {
					setEntryPoints(entryPoints);
				}
				if (setMiddlewareEntryPoint) {
					setMiddlewareEntryPoint(middlewareEntryPoint);
				}
			},
			'astro:build:done': ({ routes }) => {
				if (setRoutes) {
					setRoutes(routes);
				}
			},
		},
	};
}
