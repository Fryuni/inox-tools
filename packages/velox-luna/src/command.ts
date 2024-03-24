import { parseArgs } from 'node:util';

export function parseCommand() {
	const {
		positionals: [locale, targetFile, other],
		values: { config: configPath, rebuild = false },
	} = parseArgs({
		options: {
			config: {
				type: 'string',
				multiple: false,
				short: 'c',
				default: './lunaria.config.json',
			},
			rebuild: {
				type: 'boolean',
				multiple: false,
				short: 'r',
				default: false,
			},
		},
		allowPositionals: true,
		strict: true,
	});

	if (locale === undefined) {
		throw new Error('Missing locale argument');
	}

	if (targetFile === undefined) {
		throw new Error('Missing targetFile argument');
	}

	if (other !== undefined) {
		throw new Error('Unexpected argument: ' + other);
	}

	if (!configPath) {
		throw new Error('Missing config argument.');
	}

	return { locale, targetFile, configPath, rebuild };
}
