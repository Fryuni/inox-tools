

const __f0 = async () => {
				// Fetch configuration from some remote place when the server is initialized
				const res = await fetch('https://httpbin.org/json');
				return res.json();
			};
const __defaultExport = await __f0();

export default __defaultExport;