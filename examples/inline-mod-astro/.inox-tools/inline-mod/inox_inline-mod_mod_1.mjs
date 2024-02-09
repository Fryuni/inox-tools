

function __f0(__0, __1) {
  return (function() {
const configUrl = "file:///Users/marciaalves/.guto/inox-tools/examples/inline-mod-astro/astro.config.mjs";
return (context, next) => {
				context.locals.middlewarePerRequestValues = {
					now: new Date(),
					addedFrom: configUrl,
				};

				return next();
			};

  }).apply(undefined, undefined).apply(this, arguments);
}

export const onRequest = __f0;
