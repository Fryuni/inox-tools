

function __f0(__0) {
  return (function() {
const configUrl = "file:///Users/marciaalves/.guto/inox-tools/examples/inline-mod-astro/astro.config.mjs";
return (context) => {
				return new Response(
					`Hello, world! I'm running on ${context.generator}.\n` +
						`And I was defined in ${configUrl}`
				);
			};

  }).apply(undefined, undefined).apply(this, arguments);
}

export const GET = __f0;
