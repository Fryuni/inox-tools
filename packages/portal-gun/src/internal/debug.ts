import debugC from 'debug';

export const debug = debugC('inox-tools:portal-gun')

export const getDebug = (segment?: string) => {
  return segment ? debug.extend(segment) : debug;
}
