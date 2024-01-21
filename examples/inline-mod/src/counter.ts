import { interceptCounter } from 'virtual:interceptors';

export function setupCounter(element: HTMLButtonElement) {
	let counter = 0;
	const setCounter = (count: number) => {
		counter = interceptCounter(count);
		element.innerHTML = `count is ${counter}`;
	};
	element.addEventListener('click', () => setCounter(counter + 1));
	setCounter(0);
}
