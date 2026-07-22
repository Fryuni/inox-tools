import { KROKI_URL } from 'astro:env/server';

/**
 * Render a Mermaid diagram to an SVG string via the Kroki HTTP API.
 *
 * The Kroki instance URL is configured via the `KROKI_URL` environment variable.
 * Defaults to the public instance at https://kroki.io.
 *
 * @param code  - Mermaid diagram source
 * @param theme - Mermaid theme name (`'default'` for light, `'dark'` for dark)
 */
export async function renderMermaidToSvg(code: string, theme: 'default' | 'dark'): Promise<string> {
	// Prepend a Mermaid init directive to set the theme.
	const source = `%%{init: {'theme': '${theme}'}}%%\n${code.trim()}`;

	const url = `${KROKI_URL.replace(/\/+$/, '')}/mermaid/svg`;

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'text/plain' },
		body: source,
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Kroki returned ${response.status}: ${body}`);
	}

	return response.text();
}
