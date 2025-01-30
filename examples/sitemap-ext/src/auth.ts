import type { AstroGlobal } from 'astro';
import { endRequest } from '@it-astro:cut-short';

export function getUser(Astro: AstroGlobal): { id: string; permissions: string[] } {
	const cookie = Astro.cookies.get('username');
	if (cookie === undefined) {
		endRequest(Astro.redirect('/signin'));
	}

	return {
		id: cookie.value,
		permissions: [],
	};
}

export function validateUserPermisssion(Astro: AstroGlobal, permission: string): void {
	const user = getUser(Astro);

	if (!user.permissions.includes(permission)) {
		endRequest(Astro.redirect('/404'));
	}
}
