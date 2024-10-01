import { isCartOpen, addCartItem } from '../cartStore';
import type { CartItemDisplayInfo } from '../cartStore';
import type { ComponentChildren } from 'preact';

type Props = {
	item: CartItemDisplayInfo;
	children: ComponentChildren;
};

export default function AddToCartForm({ item, children }: Props) {
	async function addToCart(e: SubmitEvent) {
		e.preventDefault();
		isCartOpen.set(true);
		addCartItem(item);
	}

	return (
		<>
			<portal to="header">
				<p>Adding to the header</p>
			</portal>
			<portal to="head">
				<meta name="injector" content="preact element" />
			</portal>
			<form onSubmit={addToCart}>{children}</form>;
		</>
	);
}
