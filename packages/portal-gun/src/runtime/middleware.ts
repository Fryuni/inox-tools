import type { MiddlewareHandler } from 'astro';
import { rehype } from 'rehype';
import type * as hast from 'hast';
import * as visitor from 'unist-util-visit';
import { debug } from '../internal/debug.js';

const processor = rehype();

export const onRequest: MiddlewareHandler = async (_, next) => {
  const response = await next();
  if (response.headers.get('content-type')?.includes('text/html') !== true) {
    return response;
  }

  const body = await response.text();
  const tree = processor.parse(body);

  const portalContents = new Map<string, hast.ElementContent[]>();

  visitor.visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'portal') return visitor.CONTINUE;

    const target = node.properties?.to;
    if (typeof target !== 'string') return visitor.CONTINUE;

    debug(`Sending ${node.children.length} children to portal ${target}`);

    const children = portalContents.get(target) ?? [];
    children.push(...node.children);
    portalContents.set(target, children);

    if (parent && index !== undefined) {
      parent.children.splice(index, 1);

      // Continue to the same index, which is now the following element
      return [visitor.CONTINUE, index];
    }
  });

  visitor.visit(tree, 'element', (node, index, parent) => {
    if (!parent || index === undefined) return visitor.CONTINUE;
    if (
      !(node.tagName === 'portal' || (node.tagName === 'link' && node.properties?.as === 'portal'))
    )
      return visitor.CONTINUE;

    let name = node.tagName === 'portal' ? node.properties?.name : node.properties?.rel;
    if (Array.isArray(name)) {
      name = name[0];
    }
    if (typeof name !== 'string') return visitor.CONTINUE;

    const children = portalContents.get(name) ?? [];

    debug(`Receiving ${children.length} children into portal ${name}`);

    parent.children.splice(index, 1, ...children);
  });

  const newBody = processor.stringify(tree);

  return new Response(newBody, response);
};
