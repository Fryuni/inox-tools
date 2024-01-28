import type { AstroIntegration } from "astro";

export const integration = (): AstroIntegration => {
	return {
		name: "package-name",
		hooks: {},
	};
};
