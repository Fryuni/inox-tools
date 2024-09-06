import { defineAction } from 'astro:actions';
import { CART_COOKIE_NAME, cookieOptions, extractCartCookie } from '../cookies';
import { z } from 'astro/zod';

export const server = {
	setCartItem: defineAction({
		input: z.object({
			id: z.string(),
			quantity: z.number(),
		}),
		handler: async (input, ctx) => {
			const currentCookie = extractCartCookie(ctx.cookies);

			const newCookie = {
				...currentCookie,
				[input.id]: {
					id: input.id,
					quantity: input.quantity,
				},
			};

			ctx.cookies.set(CART_COOKIE_NAME, newCookie, cookieOptions(ctx.url));
		},
	}),
};
