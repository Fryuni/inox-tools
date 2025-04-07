import type { SSRResult } from 'astro';
import { createAstro, type createComponent as $createComponent } from 'astro/compiler-runtime';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import { CarrierError, LOCALS_KEY } from '../internal/carrier.js';

export function wrapCreateComponent(
	createComponent: typeof $createComponent
): typeof $createComponent {
	return (factoryOrOptions, moduleId, propagation) => {
		if (typeof factoryOrOptions === 'function') {
			factoryOrOptions = wrapFactory(factoryOrOptions);
		} else {
			factoryOrOptions.factory = wrapFactory(factoryOrOptions.factory);
		}

		return createComponent(factoryOrOptions, moduleId, propagation);
	};
}

const Astro = createAstro(undefined);

function wrapFactory(factory: AstroComponentFactory): AstroComponentFactory {
	return Object.assign(async (result: SSRResult, props: any, slots: any) => {
		const localAstro = result.createAstro(Astro, props, slots);
		const state = localAstro.locals[LOCALS_KEY];

		if (!state.response) {
			state.response = result.response;
		}

		try {
			const res = await factory(result, props, slots);

			if (res instanceof Response) {
				// Ensures a component returning a response gets propagated all the way up.
				throw new CarrierError(res);
			}

			return res;
		} catch (error) {
			state.innerError ??= error;

			throw error;
		}
	}, factory);
}
