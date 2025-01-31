type ResponseData = {
	ok: boolean;
	status?: number;
	body: unknown;
};

const simpleFetchCache = new Map<string, Promise<ResponseData> | ResponseData>();

export function simpleFetch(url: string | URL): Promise<ResponseData> {
	const cached = simpleFetchCache.get(url.toString());
	if (cached) {
		return Promise.resolve(cached);
	}

	const promise = new Promise<ResponseData>(async (resolve, reject) => {
		try {
			const res = await fetch(url);
			const content = await res.json();

			const response: ResponseData = {
				ok: res.ok,
				status: res.status,
				body: content,
			};

			simpleFetchCache.set(url.toString(), response);
			resolve(response);
		} catch (error) {
			reject(error);
			if (Object.is(simpleFetchCache.get(url.toString()), promise)) {
				simpleFetchCache.delete(url.toString());
			}
		}
	});

	simpleFetchCache.set(url.toString(), promise);

	return promise;
}
