import croct from '@croct/plug';
import type { GlobalPlug } from '@croct/plug/plug.js';

croct.plug({
	appId: import.meta.env.PUBLIC_CROCT_APP_ID,
	debug: import.meta.env.DEV,
	cidAssignerEndpointUrl: new URL('/api/cid-assigner', window.location.href).toString(),
	token: null,
});

declare global {
	interface Window {
		croct: GlobalPlug;
	}
}

window.croct = croct;

export default croct;
export { croct };
