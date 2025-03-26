'use client'

import {useEffect, useMemo, useState} from "react";

let PROMISE_CACHE: {
	[key: string]: any
} = {}

export function usePromise<T extends (...args: any[]) => Promise<unknown>>(promise: T, keyOrCondition?: any) {
	const key = useMemo(() => typeof keyOrCondition === 'string' ? keyOrCondition : undefined, [keyOrCondition]);
	const cache = useMemo(() => key ? PROMISE_CACHE[key] : undefined, [key]);
	type RType = Awaited<ReturnType<T>>;
	const [result, setResult] = useState<RType>(cache)
	const [loading, setLoading] = useState(!cache && keyOrCondition !== false);

	const fetch = async () => {
		const R = await promise().catch(()=>undefined);
		if (key) PROMISE_CACHE[key] = result;
		setResult(R as RType);
		setLoading(false);
	}

	useEffect(() => {
		if (typeof keyOrCondition === 'boolean' && !keyOrCondition) return;
		if (cache) setResult(cache);
		fetch().catch(console.error);
	}, [keyOrCondition]);
	useEffect(() => {
		if (key)
			PROMISE_CACHE[key] = result;
	}, [result]);


	return {
		loading,
		result: result as RType,
		refetch: () => {
			setLoading(true);
			fetch().catch(console.error);
		}
	}
}
