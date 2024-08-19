import { shared } from '@it-astro:request-nanostores';
import { atom, map, task } from 'nanostores';
import { actions } from 'astro:actions';

export const isCartOpen = shared('isCartOpen', atom(false));

export type CartItem = {
	id: string;
	name: string;
	imageSrc: string;
	quantity: number;
};

export type CartItemDisplayInfo = Pick<CartItem, 'id' | 'name' | 'imageSrc'>;

export const cartItems = shared('cartItems', map<Record<string, CartItem>>({}));

export function addCartItem({ id, name, imageSrc }: CartItemDisplayInfo) {
	task(async () => {
		const existingEntry = cartItems.get()[id];
		const newEntry = existingEntry
			? {
				...existingEntry,
				quantity: existingEntry.quantity + 1,
			}
			: {
				id,
				name,
				imageSrc,
				quantity: 1,
			};

		cartItems.setKey(id, newEntry);

		await actions.setCartItem({
			id: newEntry.id,
			quantity: newEntry.quantity,
		});
	});
}
