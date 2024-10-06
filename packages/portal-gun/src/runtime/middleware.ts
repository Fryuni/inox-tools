import type { MiddlewareHandler } from 'astro';
import { rehype } from 'rehype';
import type * as hast from 'hast';
import * as visitor from '@inox-tools/utils/unist/visit';
import { debug } from '../internal/debug.js';
import { logger } from '@it-astro:logger:portal-gun';
import {
	APPEND_PREFIX,
	ENTRY_PORTAL_TAG,
	EXIT_PORTAL_TAG,
	PREPEND_PREFIX,
} from '../internal/constants.js';

const processor = rehype();

export const onRequest: MiddlewareHandler = async (_, next) => {
	const response = await next();
	if (response.headers.get('content-type')?.includes('text/html') !== true) {
		return response;
	}

	const body = await response.text();
	const tree = processor.parse(body);

	const portalContents = new Map<string, hast.ElementContent[][]>();
	const landingPortals: Array<{
		name: string;
		landContent: () => void;
	}> = [];

	function portalIn(node: hast.Element, parents: hast.Parent[]): visitor.VisitorResult {
		const name = node.properties?.to;
		if (typeof name !== 'string') {
			logger.warn('Incoming portal without valid target');
			debug('Incoming portal without target', node.properties);
			return;
		}

		debug(`Sending ${node.children.length} children to portal ${name}`);

		const content = portalContents.get(name) ?? [];
		content.push(node.children);
		portalContents.set(name, content);

		const parent = parents.at(-1);
		const index = parent?.children.indexOf(node);

		if (parent !== undefined && index !== undefined) {
			parent.children.splice(index, 1);
			return [visitor.CONTINUE, index];
		}
	}

	function portalOut(node: hast.Element, parents: hast.Parent[]): visitor.VisitorResult {
		const name = node.properties?.name;
		if (parents.length === 0 || typeof name !== 'string') {
			logger.warn('Outgoing portal without valid name');
			debug('Outgoing portal without name', node.properties);
			return;
		}

		landingPortals.push({
			name: name,
			landContent: () => {
				const content = portalContents.get(name) ?? [];
				const parent = parents.at(-1)!;
				parent.children.splice(
					parent.children.indexOf(node),
					1,
					...node.children,
					...content.flat(1)
				);
			},
		});
	}

	// Activate all the portals
	visitor.visitParents({
		tree,
		test: 'element',
		leave: (node, parents) => {
			let boundaryPortalName = node.tagName;
			switch (node.tagName) {
				case EXIT_PORTAL_TAG:
					return portalOut(node, parents);
				case ENTRY_PORTAL_TAG:
					return portalIn(node, parents);
				case 'body':
				case 'head':
					break;
				default: {
					const id = node.properties.id;
					if (typeof id === 'string') {
						boundaryPortalName = `#${id}`;
						break;
					} else {
						return;
					}
				}
			}

			debug(`Adding boundary portals to ${boundaryPortalName}`);

			landingPortals.push({
				name: PREPEND_PREFIX + boundaryPortalName,
				landContent: () => {
					const content = portalContents.get(PREPEND_PREFIX + boundaryPortalName) ?? [];
					node.children.unshift(...content.flat(1));
				},
			});
			landingPortals.push({
				name: APPEND_PREFIX + boundaryPortalName,
				landContent: () => {
					const content = portalContents.get(APPEND_PREFIX + boundaryPortalName) ?? [];
					node.children.push(...content.flat(1));
				},
			});
		},
	});

	// Land all elements through the portals
	// We do this backwards to properly handle nested portals
	for (let i = landingPortals.length - 1; i >= 0; i--) {
		const portal = landingPortals[i];
		portal.landContent();
	}

	const newBody = processor.stringify(tree);

	return new Response(newBody, response);
};
