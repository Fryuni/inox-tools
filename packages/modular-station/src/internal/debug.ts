import debugC from 'debug';

debugC.inspectOpts = {
  colors: true,
  depth: 10,
  showHidden: true,
};

export const debug = debugC('inox-tools:modular-station');

export function getDebug(name: string): debugC.Debugger {
  return debug.extend(name);
}
