import { loadFixture } from '@inox-tools/astro-tests/astroFixture';
import testAdapter from '@inox-tools/astro-tests/testAdapter';
import { test, expect } from 'vitest';

const fixture = await loadFixture({
	root: './fixture/race',
	adapter: testAdapter(),
});

await fixture.build({});
const app = await fixture.loadTestAdapterApp();

test('concurrent requests have independent state', async () => {
	const responses = await Promise.all(
		Array(5)
			.fill(null)
			.map(async (_, index) => {
				const delay = 200 * (index + 1);
				const url = new URL('https://example.com/race');
				url.searchParams.set('delay', delay.toFixed(0));

				const response = await app.render(new Request(url));
				return response.json();
			})
	);

	expect(responses).toEqual([
		{
			requestId: 1,
			afterDelay: 1,
		},
		{
			requestId: 2,
			afterDelay: 2,
		},
		{
			requestId: 3,
			afterDelay: 3,
		},
		{
			requestId: 4,
			afterDelay: 4,
		},
		{
			requestId: 5,
			afterDelay: 5,
		},
	]);
});
