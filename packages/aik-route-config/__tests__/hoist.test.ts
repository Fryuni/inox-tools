import { test, expect } from 'vitest';
import { loadAstroFixture } from './utils.js';
import { hoistImport } from '../hoistGlobalPlugin.js';

test('Nothing to hoist', async () => {
	const astroCode = await loadAstroFixture('nothing');

	const result = hoistImport('magic:hoist', '/src/pages/simple.astro', astroCode);

	expect(result).toMatchInlineSnapshot(`null`);
});

test('hoist simple call', async () => {
	const astroCode = await loadAstroFixture('simple');

	const result = hoistImport('magic:hoist', '/src/pages/simple.astro', astroCode);

	expect(result?.code).toMatchInlineSnapshot(`
    "import {
      Fragment,
      render as $$render,
      createAstro as $$createAstro,
      createComponent as $$createComponent,
      renderComponent as $$renderComponent,
      renderHead as $$renderHead,
      maybeRenderHead as $$maybeRenderHead,
      unescapeHTML as $$unescapeHTML,
      renderSlot as $$renderSlot,
      mergeSlots as $$mergeSlots,
      addAttribute as $$addAttribute,
      spreadAttributes as $$spreadAttributes,
      defineStyleVars as $$defineStyleVars,
      defineScriptVars as $$defineScriptVars,
      renderTransition as $$renderTransition,
      createTransitionScope as $$createTransitionScope,
      renderScript as $$renderScript,
      createMetadata as $$createMetadata
    } from "astro/runtime/server/index.js";
    import customName from 'magic:hoist';


    import * as $$module1 from 'magic:hoist';

    export const $$metadata = $$createMetadata("<stdin>", { modules: [{ module: $$module1, specifier: 'magic:hoist', assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: new Set([]), hoisted: [] });

    const $$Astro = $$createAstro();

    await customName({
      bundleFile: import.meta.url,
      sourceFile: "/src/pages/simple.astro"
    }, 'hosted value');

    const Astro = $$Astro;
    const $$stdin = $$createComponent(async ($$result, $$props, $$slots) => {
      const Astro = $$result.createAstro($$Astro, $$props, $$slots);
      Astro.self = $$stdin;


      return $$render\`\${$$maybeRenderHead($$result)}<p>Simple page</p>\`;
    }, '<stdin>', undefined);
    export default $$stdin;
    "
  `);
});

test('hoist awaited call', async () => {
	const astroCode = await loadAstroFixture('awaited');

	const result = hoistImport('magic:hoist', '/src/pages/simple.astro', astroCode);

	expect(result?.code).toMatchInlineSnapshot(`
    "import {
      Fragment,
      render as $$render,
      createAstro as $$createAstro,
      createComponent as $$createComponent,
      renderComponent as $$renderComponent,
      renderHead as $$renderHead,
      maybeRenderHead as $$maybeRenderHead,
      unescapeHTML as $$unescapeHTML,
      renderSlot as $$renderSlot,
      mergeSlots as $$mergeSlots,
      addAttribute as $$addAttribute,
      spreadAttributes as $$spreadAttributes,
      defineStyleVars as $$defineStyleVars,
      defineScriptVars as $$defineScriptVars,
      renderTransition as $$renderTransition,
      createTransitionScope as $$createTransitionScope,
      renderScript as $$renderScript,
      createMetadata as $$createMetadata
    } from "astro/runtime/server/index.js";
    import customName from 'magic:hoist';


    import * as $$module1 from 'magic:hoist';

    export const $$metadata = $$createMetadata("<stdin>", { modules: [{ module: $$module1, specifier: 'magic:hoist', assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: new Set([]), hoisted: [] });

    const $$Astro = $$createAstro();

    await customName({
      bundleFile: import.meta.url,
      sourceFile: "/src/pages/simple.astro"
    }, 'hosted value');

    const Astro = $$Astro;
    const $$stdin = $$createComponent(async ($$result, $$props, $$slots) => {
      const Astro = $$result.createAstro($$Astro, $$props, $$slots);
      Astro.self = $$stdin;


      return $$render\`\${$$maybeRenderHead($$result)}<p>Simple page</p>\`;
    }, '<stdin>', undefined);
    export default $$stdin;
    "
  `);
});

test('hoist calls mixed with other exports and scopes', async () => {
	const astroCode = await loadAstroFixture('otherExports');

	const result = hoistImport('magic:hoist', '/src/pages/simple.astro', astroCode);

	expect(result?.code).toMatchInlineSnapshot(`
    "import {
      Fragment,
      render as $$render,
      createAstro as $$createAstro,
      createComponent as $$createComponent,
      renderComponent as $$renderComponent,
      renderHead as $$renderHead,
      maybeRenderHead as $$maybeRenderHead,
      unescapeHTML as $$unescapeHTML,
      renderSlot as $$renderSlot,
      mergeSlots as $$mergeSlots,
      addAttribute as $$addAttribute,
      spreadAttributes as $$spreadAttributes,
      defineStyleVars as $$defineStyleVars,
      defineScriptVars as $$defineScriptVars,
      renderTransition as $$renderTransition,
      createTransitionScope as $$createTransitionScope,
      renderScript as $$renderScript,
      createMetadata as $$createMetadata
    } from "astro/runtime/server/index.js";
    import customName from 'magic:hoist';


    import * as $$module1 from 'magic:hoist';

    export const $$metadata = $$createMetadata("<stdin>", { modules: [{ module: $$module1, specifier: 'magic:hoist', assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: new Set([]), hoisted: [] });

    const $$Astro = $$createAstro();

    await customName({
        bundleFile: import.meta.url,
        sourceFile: "/src/pages/simple.astro"
    }, 'hoisted value');

    await customName({
        bundleFile: import.meta.url,
        sourceFile: "/src/pages/simple.astro"
    }, 'second hoisted value');

    const Astro = $$Astro;
    export function getStaticPaths() {
    	customName({
            bundleFile: import.meta.url,
            sourceFile: "/src/pages/simple.astro"
        }, 'should be extended in-place');
    	return [];
    }
    const $$stdin = $$createComponent(async ($$result, $$props, $$slots) => {
        const Astro = $$result.createAstro($$Astro, $$props, $$slots);
        Astro.self = $$stdin;


        function notExported() {
            void 0;
        }


        return $$render\`\${$$maybeRenderHead($$result)}<p>Simple page</p>\`;
    }, '<stdin>', undefined);
    export default $$stdin;
    "
  `);
});
