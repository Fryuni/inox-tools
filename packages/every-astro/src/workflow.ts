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

export async function runEveryAstro(deps: EveryAstroDependencies): Promise<void> {
	const astroMajor = await deps.installedAstroMajor();
	const firstReleaseRevision = `astro@${astroMajor}.0.0`;
	const firstReleaseLabel = `v${astroMajor}.0.0`;
	const session = await deps.createSession();
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
	} finally {
		await session.close();
	}

	deps.log(result);
}
