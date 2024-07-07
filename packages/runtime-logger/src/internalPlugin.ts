import type { Plugin } from 'vite';

export const INTERNAL_MODULE = '@it-astro:logger-internal';
const RESOLVED_INTERNAL_MODULE = '\x00@it-astro:logger-internal';

export const loggerInternalsPlugin: Plugin = {
	name: '@inox-tools/runtime-logger/internal',
	resolveId(id) {
		if (id === INTERNAL_MODULE) {
			return RESOLVED_INTERNAL_MODULE;
		}
	},
	load(id) {
		if (id !== RESOLVED_INTERNAL_MODULE) return;

		return `
const consoleLogDestination = {
	write(event) {
		let dest = console.error;
		if (levels[event.level] < levels['error']) {
			dest = console.log;
		}
		if (event.label === 'SKIP_FORMAT') {
			dest(event.message);
		} else {
			dest(getEventPrefix(event) + ' ' + event.message);
		}
		return true;
	},
};

class AstroIntegrationLogger {
	constructor(logging, label) {
		this.options = logging;
		this.label = label;
	}

	fork(label) {
		return new AstroIntegrationLogger(this.options, label);
	}

	info(message) {
		log(this.options, 'info', this.label, message);
	}
	warn(message) {
		log(this.options, 'warn', this.label, message);
	}
	error(message) {
		log(this.options, 'error', this.label, message);
	}
	debug(message) {
		log(this.options, 'debug', this.label, message);
	}
}

export const baseLogger = new AstroIntegrationLogger({
  level: 'warn',
  dest: consoleLogDestination,
}, '');

const levels = {
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	silent: 90,
};

function log(opts, level, label, message) {
	const logLevel = opts.level;
	const dest = opts.dest;
	const event = {
		label,
		level,
		message,
		newLine: true,
	};

	if (levels[logLevel] > levels[level]) {
		return;
	}

	dest.write(event);
}

const dateTimeFormat = new Intl.DateTimeFormat([], {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
});

function getEventPrefix({ level, label }) {
	const timestamp = \`\${dateTimeFormat.format(new Date())}\`;
	const prefix = [];
	if (level === 'error' || level === 'warn') {
		prefix.push(timestamp);
		prefix.push(\`[\${level.toUpperCase()}]\`);
	} else {
		prefix.push(timestamp);
	}
	if (label) {
		prefix.push(\`[\${label}]\`);
	}
	if (prefix.length === 1) {
		return prefix[0];
	}
	return prefix.join(' ');
}
`;
	},
};
