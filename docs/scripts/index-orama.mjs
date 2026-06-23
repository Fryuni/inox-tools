#!/usr/bin/env node
/**
 * Post-build script: re-index the built documentation in Orama Cloud.
 *
 * Walks the static HTML output produced by `@astrojs/vercel` (one HTML file per
 * route under `.vercel/output/static/**`), extracts the title and readable
 * content for each page, then pushes the documents into a temporary Orama
 * Cloud index and atomically swaps it with the live one.
 *
 * Required environment variables:
 *   - ORAMA_CLOUD_PROJECT_ID      (same as the client-side public project id)
 *   - ORAMA_CLOUD_DATASOURCE_ID   (the REST API data source id)
 *   - ORAMA_CLOUD_PRIVATE_API_KEY (write-scoped key, Vercel secret)
 *
 * Usage:
 *   node ./scripts/index-orama.mjs                      # real ingestion
 *   node ./scripts/index-orama.mjs --dry-run            # extract only, print stats
 *   ORAMA_CLOUD_PRIVATE_API_KEY= node ./scripts/... --dry-run
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseHtml } from 'node-html-parser';
import { OramaCloud } from '@orama/core';

const DRY_RUN = process.argv.includes('--dry-run');
const DOCS_ROOT = fileURLToPath(new URL('../', import.meta.url));
const STATIC_ROOT = join(DOCS_ROOT, '.vercel', 'output', 'static');
const BATCH_SIZE = 50;

// Routes that are built but should never appear in search results.
const EXCLUDED_URLS = new Set(['/404']);
const PROJECT_ID = process.env.ORAMA_CLOUD_PROJECT_ID;
const DATASOURCE_ID = process.env.ORAMA_CLOUD_DATASOURCE_ID;
const PRIVATE_API_KEY = process.env.ORAMA_CLOUD_PRIVATE_API_KEY;

function log(msg) {
	console.log(`[orama-index] ${msg}`);
}

function die(msg, code = 1) {
	console.error(`[orama-index] ${msg}`);
	process.exit(code);
}

async function* walkHtmlFiles(dir) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (err) {
		if (err.code === 'ENOENT') return;
		throw err;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walkHtmlFiles(full);
		} else if (entry.isFile() && entry.name.endsWith('.html')) {
			yield full;
		}
	}
}

/**
 * Convert an absolute path under `.vercel/output/static` into the public URL
 * path (matching the Astro config's `trailingSlash: 'never'`).
 *
 *   static/index.html          -> /
 *   static/cut-short.html      -> /cut-short
 *   static/inline-mod/api.html -> /inline-mod/api
 */
function filePathToUrl(filePath) {
	const rel = relative(STATIC_ROOT, filePath).split(sep).join('/');
	if (rel === 'index.html') return '/';
	if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
	if (rel.endsWith('.html')) return '/' + rel.slice(0, -'.html'.length);
	return '/' + rel;
}

/**
 * Extract a searchable document from a built Starlight HTML page.
 * Returns `null` when the page is not a docs page (404, auto-generated fallback, etc.).
 */
function extractDocument(html, url) {
	// `node-html-parser` treats <pre> as a block-text element by default, which
	// causes its inner HTML to be returned verbatim from `.text`. Turn it off
	// so that when we later strip <pre> blocks we actually remove structured
	// code, not a single opaque text node.
	const root = parseHtml(html, {
		blockTextElements: {
			script: true,
			style: true,
			noscript: true,
			pre: false,
		},
	});

	// Starlight wraps each page's body in <main data-pagefind-body>, which is
	// the signal that the page participates in search. Skip pages without it.
	const main = root.querySelector('main');
	if (!main) return null;

	// Strip elements that only add noise: site nav, tabs of code blocks, copy
	// buttons, etc. These live outside the article body but leak into main.
	for (const sel of [
		'header',
		'footer',
		'nav',
		'aside',
		'script',
		'style',
		'noscript',
		// Code blocks add noisy highlighter markup and rarely carry useful search terms.
		'pre',
		'[data-pagefind-ignore]',
	]) {
		for (const el of main.querySelectorAll(sel)) el.remove();
	}

	const titleEl = main.querySelector('h1') ?? root.querySelector('head > title');
	const title = (titleEl?.text ?? '').trim();
	if (!title) return null;

	// The sidebar "category" of each page is the closest <h2>/<h3> ancestor or
	// the containing directory segment (e.g. 'inline-mod', 'content-utils').
	const segments = url.split('/').filter(Boolean);
	const category = segments.length > 1 ? segments[0] : 'guides';

	const content = main.text.replace(/\s+/g, ' ').trim();
	if (!content) return null;

	return {
		id: url,
		url,
		title,
		category,
		content,
	};
}

async function collectDocuments() {
	if (!existsSync(STATIC_ROOT)) {
		die(`Static build output not found at ${STATIC_ROOT}. Run \`astro build\` before indexing.`);
	}

	const docs = [];
	for await (const file of walkHtmlFiles(STATIC_ROOT)) {
		const html = await readFile(file, 'utf8');
		const url = filePathToUrl(file);
		if (EXCLUDED_URLS.has(url)) continue;
		const doc = extractDocument(html, url);
		if (doc) docs.push(doc);
	}
	return docs;
}

async function ingest(documents) {
	const orama = new OramaCloud({
		projectId: PROJECT_ID,
		apiKey: PRIVATE_API_KEY,
	});
	const datasource = orama.dataSource(DATASOURCE_ID);

	log('Creating temporary index...');
	const temporary = await datasource.createTemporaryIndex();

	log(`Inserting ${documents.length} documents in batches of ${BATCH_SIZE}...`);
	for (let i = 0; i < documents.length; i += BATCH_SIZE) {
		const batch = documents.slice(i, i + BATCH_SIZE);
		await temporary.insertDocuments(batch);
		log(`  inserted ${Math.min(i + BATCH_SIZE, documents.length)} / ${documents.length}`);
	}

	log('Swapping temporary index with live index...');
	await temporary.swap();
	log('Done.');
}

async function main() {
	const documents = await collectDocuments();
	log(`Extracted ${documents.length} documents.`);
	if (documents.length === 0) {
		die('No documents extracted — refusing to swap an empty index.');
	}

	if (DRY_RUN) {
		log('Dry run — skipping Orama Cloud API calls.');
		const sample = documents[0];
		log(
			`First document: ${JSON.stringify({ ...sample, content: sample.content.slice(0, 120) + '…' }, null, 2)}`
		);
		return;
	}

	const missing = [
		['ORAMA_CLOUD_PROJECT_ID', PROJECT_ID],
		['ORAMA_CLOUD_DATASOURCE_ID', DATASOURCE_ID],
		['ORAMA_CLOUD_PRIVATE_API_KEY', PRIVATE_API_KEY],
	]
		.filter(([, v]) => !v)
		.map(([k]) => k);

	if (missing.length > 0) {
		// On preview / PR deployments the private key is often not available.
		// Treat this as a soft-skip so the build still succeeds.
		log(`Skipping ingestion: missing env var(s): ${missing.join(', ')}`);
		return;
	}

	await ingest(documents);
}

main().catch((err) => {
	console.error('[orama-index] Ingestion failed:', err);
	process.exit(1);
});
