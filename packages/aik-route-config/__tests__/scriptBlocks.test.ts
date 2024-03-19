import { test, expect } from 'vitest';
import { TestLogger, loadAstroFixture } from './utils.js';
import { hoistImport } from '../hoistGlobalPlugin.js';

test('ignore script blocks', async () => {
	const astroCode = await loadAstroFixture('scriptBlock');

	const result = hoistImport({
		magicImport: 'i18n:astro/sitemap',
		currentModule: '/src/pages/index.astro',
		code: astroCode,
		logger: new TestLogger(),
	});

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
    import { t } from 'i18n:astro';
    import Layout from '~/layouts/Layout.astro';
    import sitemap from 'i18n:astro/sitemap';


    import * as $$module1 from 'i18n:astro';
    import * as $$module2 from '~/layouts/Layout.astro';
    import * as $$module3 from 'i18n:astro/sitemap';
    import * as $$module4 from 'i18n:astro';

    export const $$metadata = $$createMetadata("<stdin>", { modules: [{ module: $$module1, specifier: 'i18n:astro', assert: {} }, { module: $$module2, specifier: '~/layouts/Layout.astro', assert: {} }, { module: $$module3, specifier: 'i18n:astro/sitemap', assert: {} }, { module: $$module4, specifier: 'i18n:astro', assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: new Set([]), hoisted: [{ type: 'inline', value: \`
    		import { t } from 'i18n:astro';

    		document.getElementById('span')!.innerHTML = t('about');
    	\` }] });

    const $$Astro = $$createAstro();

    await sitemap({
        bundleFile: import.meta.url,
        sourceFile: "/src/pages/index.astro"
    }, 'TEST');

    const Astro = $$Astro;
    const $$stdin = $$createComponent(async ($$result, $$props, $$slots) => {
        const Astro = $$result.createAstro($$Astro, $$props, $$slots);
        Astro.self = $$stdin;

        // From:
        // https://github.com/astrolicious/i18n/blob/a69646636ad32e42620b240fe50dff7476ab6606/playground/src/routes/index.astro



        const title = t('home:title');


        return $$render\`\${$$renderComponent($$result,'Layout',Layout,{"title":(title)},{"default": () => $$render\`
            \${$$maybeRenderHead($$result)}<h1>\${title}</h1>
            <p>\${t('home:description', { value: '9' })}</p>
            <span id="span"></span>
            
        \`,})}\`;
    }, '<stdin>', undefined);
    export default $$stdin;
    "
  `);
});
