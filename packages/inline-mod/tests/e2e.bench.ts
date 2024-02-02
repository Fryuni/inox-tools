import { faker } from '@faker-js/faker';
import { bench, expect } from 'vitest';
import { inspectInlineMod } from '../src/inlining.js';

const randomParams: Array<{ chance: number; gen: (penalty: number) => unknown }> = [
	{ chance: 1, gen: () => null },
	{ chance: 2, gen: () => Math.random() > 0.5 },
	{ chance: 10, gen: () => faker.word.words(5) },
	{ chance: 10, gen: () => faker.number.int() },
	{ chance: 5, gen: () => faker.number.bigInt() },
	{
		chance: 30,
		gen: (penalty) => {
			const length = faker.number.int({ max: 20 });

			return Array(length)
				.fill(null)
				.map(() => generateRandomValue(penalty + 10));
		},
	},
	{
		chance: 30,
		gen: (penalty) => {
			const length = faker.number.int({ max: 20 });

			const data: Record<string, unknown> = {};

			for (let i = 0; i < length; i++) {
				data[faker.word.words(3)] = generateRandomValue(penalty + 10);
			}

			return data;
		},
	},
];

const totalParams = randomParams.reduce((acc, { chance }) => acc + chance, 0);

function generateRandomValue(penalty = 0): unknown {
	let seed = faker.number.int({ max: totalParams - penalty });

	for (const choice of randomParams) {
		if ((seed -= choice.chance) <= 0) {
			return choice.gen(penalty);
		}
	}

	throw new Error('WHAAT?!?!');
}

const randomValues = Array(500)
	.fill(null)
	.map(() => generateRandomValue());

bench('serialization of simple deep object', async () => {
	const value = randomValues.pop() ?? generateRandomValue();

	const moduleValue = await inspectInlineMod({
		constExports: {
			roundtrip: value,
		},
	}).then((modInfo) => modInfo.module.get());

	expect((moduleValue as any).roundtrip).toEqual(value);
});
