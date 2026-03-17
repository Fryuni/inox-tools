import { AstroError } from 'astro/errors';
import { z } from 'astro/zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const injectedCollections = vi.hoisted(() => ({}) as Record<string, any>);

vi.mock('@it-astro:content/injector', () => ({
	injectedCollections,
}));

vi.mock('astro:content', async () => {
	const { z } = await import('astro/zod');

	return {
		defineCollection: (config: any) => config,
		z,
	};
});

import {
	defineCollection,
	isFancyCollection,
	tryGetOriginalFancyCollection,
} from '../src/runtime/fancyContent.js';
import { injectCollections } from '../src/runtime/injector.js';

afterEach(() => {
	for (const key of Object.keys(injectedCollections)) {
		delete injectedCollections[key];
	}
});

const makeFancy = () =>
	defineCollection({
		type: 'content',
		schema: z.object({
			title: z.string(),
		}),
	});

describe('fancy collections', () => {
	it('marks fancy collections and keeps track of their origin', () => {
		const fancy = makeFancy();
		const derived = fancy({
			extends: z.object({
				slug: z.string(),
			}),
		});

		expect(isFancyCollection(fancy)).toBe(true);
		expect(tryGetOriginalFancyCollection(derived)).toBe(fancy);
	});
});

describe('injectCollections', () => {
	it('merges injected collections with user extensions', () => {
		const fancy = makeFancy();
		injectedCollections.blog = fancy;

		const result = injectCollections({
			blog: fancy({
				extends: z.object({
					author: z.string(),
				}),
			}),
		});

		const schema =
			typeof result.blog.schema === 'function' ? result.blog.schema({}) : result.blog.schema;
		expect(schema?.parse({ title: 'Hello', author: 'Codex' })).toStrictEqual({
			title: 'Hello',
			author: 'Codex',
		});
		expect(() => schema?.parse({ title: 'Hello' })).toThrow();
	});

	it('throws when a project overrides an injected collection', () => {
		const fancy = makeFancy();
		injectedCollections.blog = fancy;

		expect(() =>
			injectCollections({
				blog: {
					type: 'content',
					schema: z.object({}),
				},
			})
		).toThrow(AstroError);
	});

	it('throws when extending the wrong injected collection', () => {
		const injected = makeFancy();
		const otherFancy = makeFancy();
		injectedCollections.blog = injected;

		expect(() =>
			injectCollections({
				blog: otherFancy(),
			})
		).toThrow(AstroError);
	});
});
