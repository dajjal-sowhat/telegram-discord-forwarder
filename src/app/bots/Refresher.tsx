
'use client';

import {useRouter} from "next/navigation";
import {useEffect, useRef} from "react";

function Refresher({ms = 1000}: {
	ms?: number
}) {
	const router = useRouter();
	const thread = useRef<any>();

	useEffect(() => {
		thread.current ||= setInterval(()=>{
			router.refresh();
		},ms);
		return ()=>clearInterval(thread.current);
	}, [thread]);

	return null;
}

export default Refresher;
