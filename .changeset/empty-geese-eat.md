---
'@inox-tools/aik-route-config': patch
---

Fixes hoisting for routes not using the global `Astro` variable.

When an Astro component doesn't use the `Astro` variable anywhere the `$$createAstro` call is not emmited in the compiled source (https://github.com/withastro/compiler/commit/e8b6cdfc89f940a411304787632efd8140535feb). In that case use the `$$createComponent` call as hoisting anchor instead.
