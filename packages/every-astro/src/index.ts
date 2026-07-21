import { createRuntimeDependencies } from './runtime.js';
import { isPlainAbortError, runEveryAstro } from './workflow.js';

let interruptedBy: 'SIGINT' | 'SIGTERM' | undefined;

async function main(): Promise<void> {
	const abortController = new AbortController();

	const onSigint = () => {
		interruptedBy ??= 'SIGINT';
		abortController.abort();
	};
	const onSigterm = () => {
		interruptedBy ??= 'SIGTERM';
		abortController.abort();
	};

	process.on('SIGINT', onSigint);
	process.on('SIGTERM', onSigterm);

	try {
		const dependencies = await createRuntimeDependencies(process.cwd(), abortController.signal);

		await runEveryAstro(dependencies);
	} finally {
		process.off('SIGINT', onSigint);
		process.off('SIGTERM', onSigterm);
	}
}

process.setSourceMapsEnabled(true);

main().catch((error: unknown) => {
	if (interruptedBy !== undefined && isPlainAbortError(error)) {
		// Interrupted by the user; cleanup already ran through the abort signal.
		process.exitCode = interruptedBy === 'SIGINT' ? 130 : 143;
		return;
	}

	// eslint-disable-next-line no-console
	console.error(error);

	process.exitCode = interruptedBy === undefined ? 1 : interruptedBy === 'SIGINT' ? 130 : 143;
});
