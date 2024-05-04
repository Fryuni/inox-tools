import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { transform } from '@astrojs/compiler';
import type { AstroIntegrationLogger } from 'astro';

const fixtureFolder = fileURLToPath(new URL('./fixtures', import.meta.url));

export async function loadAstroFixture(name: string) {
	const fixturePath = join(fixtureFolder, `${name}.astro`);

	const astroSrc = await readFile(fixturePath, 'utf-8');

	const result = await transform(astroSrc);

	return result.code;
}

export type TestMessage = {
	level: 'info' | 'warn' | 'error' | 'debug';
	message: string;
	label: string;
};

export class TestLogger implements AstroIntegrationLogger {
	public constructor(
		public label = 'root',
		public messages: TestMessage[] = []
	) {}

	public get options(): never {
		throw new Error('Accessing the log options is not supported in tests');
	}

	fork(label: string): TestLogger {
		return new TestLogger(label, this.messages);
	}

	info(message: string): void {
		this.messages.push({ level: 'info', message, label: this.label });
	}
	warn(message: string): void {
		this.messages.push({ level: 'warn', message, label: this.label });
	}
	error(message: string): void {
		this.messages.push({ level: 'error', message, label: this.label });
	}
	debug(message: string): void {
		this.messages.push({ level: 'debug', message, label: this.label });
	}
}
