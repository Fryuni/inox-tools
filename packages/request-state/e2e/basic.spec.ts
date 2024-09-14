import { loadFixture, type PreviewServer } from '@inox-tools/astro-tests/astroFixture';
import { test, expect } from '@playwright/test';
import * as devalue from 'devalue';

const fixture = await loadFixture({
	root: './fixture/basic',
});

let server: PreviewServer;

const injectedState: any = {
	string: 'something',
	number: 2345678,
	boolean: true,
	object: { foo: 'bar' },
	array: ['a', 'b', 'c'],
};

injectedState.circular = injectedState;

test.beforeAll(async () => {
	delete process.env.INJECTED_STATE;
	await fixture.build({});
	process.env.INJECTED_STATE = devalue.stringify(injectedState);
	server = await fixture.preview({});
});

test.afterAll(async () => {
	delete process.env.INJECTED_STATE;
	await server?.stop();
	await server?.closed();
});

test('share state', async ({ page }) => {
	let assertionFailed = false;
	page.on('console', async (msg) => {
		if (msg.type() === 'assert') {
			assertionFailed = true;
			console.error('Failed in-page assertion:', msg.text());
			return;
		}
	});

	const pageUrl = fixture.resolveUrl('/?name=John+Doe');

	await page.goto(pageUrl);

	const pageState = devalue.parse(await page.locator('pre#injected-state').innerHTML());

	expect(pageState).toStrictEqual(injectedState);
	expect(assertionFailed).toBe(false);
});
