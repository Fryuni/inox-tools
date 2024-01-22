---
title: Inline Virtual Modules
description: Pass inline JS values and functions as a virtual module to Vite projects.
sidebar:
  label: Overview
  order: 0
---

:::caution[Experimental plugin]
This library is still highly experimental. Many scenarios, even though work sometimes, have not been properly tested yet.
The public API may (and probably will) break compatibility at any moment.
:::

This libray has two parts, a inline module definition and a Vite plugin to expose those defined modules.
Plugins for other bundlers may be added using the same core logic as its base.

The idea of this library is to allow developers to pass and receive non-trivial values on configuration files
that affect the behavior of an application at runtime. For example, defining a middleware function in a config
file and having that middleware running on the server after the deployment.

Imagine if you could have a Vite plugin with this API:

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [
    yourPlugin({
      fetchFunction: (url, requestInit) => {
        console.log('Lib is calling fetch');
        return fetch(url, requestInit);
      },
    }),
  ],
});
```

And access your configuration at runtime inside your runtime code like a normal module:

```ts
// plugin/runtime.ts
import { fetchFunction } from 'yourLib:config';

const response = await fetchFunction(/* ... */);
```

No more weirdly JSON-based JS generators replicated in every project to serialize a configuration.  
No more oceans of flags an options to encode every possible use case as a plain object that can be turned into
a JSON to decide what to do at runtime. Let your consumers give you functions with exact behavior they want.

## Origins

This plugin was based on the [work by the Pulumi Corporation][original code] for their inline lambda feature.
[Pulumi](https://pulumi.com) is an Infrastructure as Code platform that allows declaring the desired state of
your infrastructure and construct those declaration using a familiar language like TypeScript, Python or Go.

:::tip
Pulumi's product is just their management portal for team collaboration and AI solutions,
the IaC engine is entirely open source with no locked features, so you can use it for free forever on personal
projects with no limits by managing the state yourself (which is easy if you don't need to manager permissions
of a team) or on smaller projects in your company for evaluating it.

Do check them out!
:::

The original work was strictly for serializing a single exported function along with its captured environment,
and was limited to CommonJS operation mode. This library ports all that logic to ECMAScript Modules and rework
all the logic to support the definition of arbitrary modules.

[original code]: https://github.com/pulumi/pulumi/tree/d4969f3338eb55f8072518ca89ed17a9b72bde93/sdk/nodejs/runtime/closure

Thank you to the authors of the original inline closure serialization code who brought this idea into existence
years ago.

### Licensing notice

Because this is a port and derivation of part of an idea that is within some existing code,
the appropriate licensing for this is somewhat confusing. This section describes all that
I currenly know about it.

The original code by Pulumi Corporation is licensed under the Apache 2.0 license.  
All the code made by me is licensed under the MIT license.

I tried to the best of my abilities to find whether this project would have some limitations
under Apache 2.0 and as far as I can tell there is none.

But I am not a lawyer, so if there _is_ an infringiment in any sense of the Apache 2.0 license
for the Pulumi code that you can explain to me, please reach out to at [luiz@lferraz.com](mailto:luiz@lferraz.com).

So at best this library is under a dual Apache 2.0 and MIT license and at worst it is fully under Apache 2.0
license in case I can't publish my derivative work under MIT. This will be updated as soon as I get confirmation about it.

As I understood, the code of this library falls into 3 categories:

#### Copied files

Some files of the original code were preserved verbatim since they apply to general JS code
regardless of the different target environments (like [this one][verbatim sample]).

Those files retain the original copyright notice from the Pulumi project as well as their
Apache 2.0 license.

[verbatim sample]: https://github.com/Fryuni/inox-tools/blob/main/packages/inline-mod/src/closure/v8.ts

#### Ported files

Some files have the same logic and goal as the original code from Pulumi, but entirely rewritten
to account for the different targets of both projects, one being solely for CJS functions and
the other for arbitrary ES modules (like [this one][rewrite sample]).

Those may contain snippets of the original code and different code that achieves the same as some
segments of Pulumi's code mixed with new code.

To the best of my knowledge, those are considered my code, so they are licensed under MIT.

[rewrite sample]: https://github.com/Fryuni/inox-tools/blob/main/packages/inline-mod/src/closure/inspectCode.ts

#### Original files

Lastly, some files were written from scratch, like the [inline module declaration][inline decl] and
[Vite plugin][vite plugin]. Those are under MIT.

[inline decl]: https://github.com/Fryuni/inox-tools/blob/main/packages/inline-mod/src/inlining.ts
[vite plugin]: https://github.com/Fryuni/inox-tools/blob/main/packages/inline-mod/src/vite.ts
[verbatim sample]: https://github.com/Fryuni/inox-tools/blob/main/packages/inline-mod/src/closure/v8.ts#L1-L13
