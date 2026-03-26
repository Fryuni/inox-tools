import type { Browser } from 'puppeteer-core';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
	if (!browserInstance || !browserInstance.connected) {
		const { default: chromium } = await import('@sparticuz/chromium');
		const { default: puppeteer } = await import('puppeteer-core');
		browserInstance = await puppeteer.launch({
			executablePath: await chromium.executablePath(),
			headless: true,
			args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
		});

		// Close browser when the Node process exits
		const close = () => void browserInstance?.close().catch(() => { });
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
export async function renderMermaidToSvg(
	code: string,
	theme: 'default' | 'dark'
): Promise<string> {
	const { renderMermaid } = await import('@mermaid-js/mermaid-cli');
	const browser = await getBrowser();

	const { data } = await renderMermaid(browser, code.trim(), 'svg', {
		mermaidConfig: { theme },
		backgroundColor: 'transparent',
	});

	return new TextDecoder().decode(data);
}
