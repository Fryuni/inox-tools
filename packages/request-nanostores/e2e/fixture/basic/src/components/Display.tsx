import type { FunctionComponent } from 'preact';
import { useStore } from '@nanostores/preact';
import { serializedState } from '../state.js';

export const Display: FunctionComponent<{ id: string }> = ({ id }) => {
	const state = useStore(serializedState);

	return <pre id={id}>{state}</pre>;
};
