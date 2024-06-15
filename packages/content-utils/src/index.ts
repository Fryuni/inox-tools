import { integration, type InjectCollectionOptions } from './integration/index.js';

// Re-export integration as default export to allow installation
// using `astro add @inox-tools/content-utils`
export default integration;

export { integration, type InjectCollectionOptions };

// For backwards compatibility, cause I'm nice
export * from './integration/utilities.js';
