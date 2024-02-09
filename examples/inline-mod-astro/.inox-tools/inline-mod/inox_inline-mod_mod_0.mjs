

const __locals = {};
const __now = new Date(1707505566969);
const __locals_build = {now: __now};
const __f1 = () => ({
					now: new Date(),
				});
const __locals_moduleInitialization = __f1();
__locals.build = __locals_build;
__locals.moduleInitialization = __locals_moduleInitialization;
function __f0(__0, __1) {
  return (function() {
const locals = __locals;
return (context, next) => {
                context.locals = { ...locals };
                return next();
              };

  }).apply(undefined, undefined).apply(this, arguments);
}

export const onRequest = __f0;
