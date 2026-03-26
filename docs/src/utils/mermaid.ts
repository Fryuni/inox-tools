import type { Browser } from 'puppeteer-core';
import { writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let browserInstance: Browser | null = null;

/**
 * Place a stub libGLESv2.so in /tmp so that @sparticuz/chromium's inflate()
 * sees it and skips the entire swiftshader.tar.br extraction.
 *
 * The inflate() check is: `existsSync(`${tmpdir()}/libGLESv2.so`)`
 *
 * SwiftShader's GPU libraries (libEGL.so, libGLESv2.so) are not needed for
 * headless SVG rendering, and extracting the tar fails with EACCES on
 * Vercel's build environment.
 */
function stubSwiftShaderLibs() {
	const sentinel = join(tmpdir(), 'libGLESv2.so');
	if (!existsSync(sentinel)) {
		try {
			writeFileSync(sentinel, '', { mode: 0o644 });
		} catch {
			// If we can't write the stub either, let executablePath() try
			// on its own — at least we tried.
		}
	}
}

async function getBrowser(): Promise<Browser> {
	if (!browserInstance || !browserInstance.connected) {
		const { default: chromium } = await import('@sparticuz/chromium');
		const { default: puppeteer } = await import('puppeteer-core');

		chromium.setGraphicsMode = false;

		// Stub out SwiftShader libs before executablePath() tries to extract them.
		stubSwiftShaderLibs();

		browserInstance = await puppeteer.launch({
			executablePath: await chromium.executablePath(),
			headless: true,
			args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
		});

		// Close browser when the Node process exits
		const close = () => void browserInstance?.close().catch(() => {});
		process.once('beforeExit', close);
		process.once('SIGINT', close);
		process.once('SIGTERM', close);
	}
	return browserInstance;
}

/**
 * Render a Mermaid diagram to an SVG string at build time.
 *
 * Uses `@mermaid-js/mermaid-cli` (Puppeteer) under the hood.
 * A single browser instance is reused across calls.
 */
export async function renderMermaidToSvg(code: string, theme: 'default' | 'dark'): Promise<string> {
	const { renderMermaid } = await import('@mermaid-js/mermaid-cli');
	const browser = await getBrowser();

	const { data } = await renderMermaid(browser, code.trim(), 'svg', {
		mermaidConfig: { theme },
		backgroundColor: 'transparent',
	});

	return new TextDecoder().decode(data);
}
