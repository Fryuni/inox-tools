export interface BisectSession {
	latestRevision(): Promise<string>;
	prepareRevision(revision: string): Promise<void>;
	runDevServerAndAsk(label: string): Promise<boolean>;
	startBisect(good: string, bad: string): Promise<void>;
	currentRevision(): Promise<string>;
	markCurrent(isBad: boolean): Promise<string | undefined>;
	close(): Promise<void>;
}

export interface EveryAstroDependencies {
	installedAstroMajor(): Promise<number>;
	createSession(): Promise<BisectSession>;
	log(message: string): void;
}

export class WorkflowCleanupError extends AggregateError {
	public constructor(
		readonly primaryError: unknown,
		readonly cleanupError: unknown
	) {
		super([primaryError, cleanupError], 'Workflow operation and session cleanup both failed.', {
			cause: primaryError,
		});
		this.name = 'WorkflowCleanupError';
	}
}

export function isPlainAbortError(error: unknown): error is Error {
	return error instanceof Error && error.name === 'AbortError';
}

export async function runEveryAstro(deps: EveryAstroDependencies): Promise<void> {
	const astroMajor = await deps.installedAstroMajor();
	const firstReleaseRevision = `astro@${astroMajor}.0.0`;
	const firstReleaseLabel = `v${astroMajor}.0.0`;
	const session = await deps.createSession();
	let operationFailed = false;
	let operationError: unknown;
	let result: string | undefined;

	try {
		const latestRevision = await session.latestRevision();

		await session.prepareRevision(latestRevision);
		if (!(await session.runDevServerAndAsk('latest'))) {
			result = 'The bug is already fixed in the latest Astro revision.';
		} else {
			await session.prepareRevision(firstReleaseRevision);
			if (await session.runDevServerAndAsk(firstReleaseLabel)) {
				result = `The bug predates Astro v${astroMajor}.`;
			} else {
				await session.startBisect(firstReleaseRevision, latestRevision);

				while (result === undefined) {
					const revision = await session.currentRevision();

					await session.prepareRevision(revision);
					const firstBadRevision = await session.markCurrent(
						await session.runDevServerAndAsk(revision)
					);

					if (firstBadRevision !== undefined) {
						result = `The bug was introduced in Astro commit ${firstBadRevision}.`;
					}
				}
			}
		}
	} catch (error) {
		operationFailed = true;
		operationError = error;
		throw error;
	} finally {
		try {
			await session.close();
		} catch (cleanupError) {
			if (operationFailed) {
				throw new WorkflowCleanupError(operationError, cleanupError);
			}

			throw cleanupError;
		}
	}

	deps.log(result);
}
