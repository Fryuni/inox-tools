import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadFixture } from '@inox-tools/astro-tests/astroFixture';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const fixturePath = fileURLToPath(new URL('./fixture/git-tracking/', import.meta.url));

const fixture = await loadFixture({
	root: './fixture/git-tracking',
});

type CommitData = {
	hash: string;
	date: string;
	author: { name: string; email: string };
	coAuthors: Array<{ name: string; email: string }>;
	content: string;
};

type EntryData = {
	id: string;
	commitCount: number;
	commits: CommitData[];
};

function extractJsonData<T>(html: string): T {
	const match = html.match(/<pre id="data">([\s\S]*?)<\/pre>/);
	if (!match) throw new Error('Could not find <pre id="data"> in HTML');
	// Unescape HTML entities that Astro may have encoded
	const json = match[1]
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
	return JSON.parse(json);
}

describe('Git commit history tracking', () => {
	beforeAll(async () => {
		// Unpack .git.tar.gz in fixture to provide real git history
		const tarResult = spawnSync('tar', ['xzf', '.git.tar.gz'], { cwd: fixturePath });
		if (tarResult.status !== 0) {
			throw new Error(`Failed to unpack .git.tar.gz: ${tarResult.stderr}`);
		}
		await fixture.clean();
		await fixture.build({});
	});

	afterAll(() => {
		// Delete .git folder to avoid polluting the repo with a nested git directory
		spawnSync('rm', ['-rf', '.git'], { cwd: fixturePath });
		fixture.resetAllFiles();
	});

	it('populates commits field with correct count', async () => {
		const html = await fixture.readFile('commits/index.html');
		expect(html).not.toBeNull();

		const data = extractJsonData<EntryData[]>(html!);

		expect(data).toBeArray();
		expect(data.length).toBeGreaterThan(0);
		expect(data[0].commitCount).toBeGreaterThan(0);
	});

	it('returns the earliest and latest dates without swapping them', async () => {
		const [datesHtml, infoHtml] = await Promise.all([
			fixture.readFile('dates/index.html'),
			fixture.readFile('dates-info/index.html'),
		]);
		expect(datesHtml).not.toBeNull();
		expect(infoHtml).not.toBeNull();

		const dates = extractJsonData<{ latest: string; oldest: string }>(datesHtml!);
		const info = extractJsonData<{ earliest: string; latest: string }>(infoHtml!);

		expect(info.earliest).not.toBe(info.latest);
		expect(dates.oldest).toBe(info.earliest);
		expect(dates.latest).toBe(info.latest);
	});

	it('lazy content getter retrieves file content at commit', async () => {
		const html = await fixture.readFile('commits/index.html');
		expect(html).not.toBeNull();

		const data = extractJsonData<EntryData[]>(html!);

		expect(data).toBeArray();
		expect(data.length).toBeGreaterThan(0);

		const entry = data[0];
		expect(entry.commits.length).toBeGreaterThan(0);

		for (const commit of entry.commits) {
			expect(commit.content).toBeString();
			expect(commit.content.length).toBeGreaterThan(0);
		}
	});

	it('returns empty commits array when collectCommitHistory is false', async () => {
		await fixture.editFile('astro.config.ts', (content) =>
			content!.replace('contentUtils()', 'contentUtils({ collectCommitHistory: false })')
		);
		await fixture.clean();
		await fixture.build({});

		const html = await fixture.readFile('commits/index.html');
		expect(html).not.toBeNull();

		const data = extractJsonData<EntryData[]>(html!);

		expect(data).toBeArray();
		expect(data.length).toBeGreaterThan(0);
		for (const entry of data) {
			expect(entry.commitCount).toBe(0);
			expect(entry.commits).toEqual([]);
		}
	});

	it('does not collect commit history in dev when collectCommitHistory is false', async () => {
		const devServer = await fixture.startDevServer({});
		try {
			const response = await fixture.fetch('/commits/');
			expect(response.ok).toBe(true);

			const data = extractJsonData<EntryData[]>(await response.text());
			expect(data).not.toHaveLength(0);
			for (const entry of data) {
				expect(entry.commitCount).toBe(0);
				expect(entry.commits).toEqual([]);
			}
		} finally {
			await devServer.stop();
		}
	});
});
