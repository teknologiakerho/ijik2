export type Hook<T extends (...args: any) => any> = {
	(...args: Parameters<T>): [ReturnType<T>];
	hook: (cb: T, order?: number) => void;
};

type Callback<T> = {
	cb: T;
	order: number;
};

export const hook = <T extends (...args: any) => any>(): Hook<T> => {
	const callbacks: Callback<T>[] = [];
	
	const call = (...args) => callbacks.map(cb => cb.cb(...args));

	call.hook = (cb, order) => {
		callbacks.push({ cb, order: order || 0 });
		callbacks.sort((a, b) => a.order - b.order);
	};

	return call as Hook<T>;
};
