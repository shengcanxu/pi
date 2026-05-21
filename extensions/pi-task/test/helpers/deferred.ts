export function deferred<TValue>(): { promise: Promise<TValue>; resolve: (value: TValue) => void } {
	let resolveValue: ((value: TValue) => void) | undefined;
	const promise = new Promise<TValue>((resolve) => {
		resolveValue = resolve;
	});
	if (resolveValue === undefined) {
		throw new Error("Deferred resolver was not initialized.");
	}
	return { promise, resolve: resolveValue };
}
