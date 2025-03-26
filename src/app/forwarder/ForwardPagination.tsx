'use client';

import {NumberInput, Pagination} from "@mantine/core";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useEffect, useState} from "react";

function ForwardPagination(props: {
	take: number,
	current: number,
	total: number
}) {
	const [take, setTake] = useState<number>(props.take);
	const totalPage = Math.ceil(props.total / props.take);
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const searchParams = useSearchParams();

	useEffect(() => {
		setLoading(false);
	}, [searchParams]);

	return (
		<div className={'flex gap-2 items-center justify-center'}>
			<Pagination
				disabled={loading}
				total={totalPage}
				defaultValue={Math.floor(props.current / props.take) + 1}
				onChange={page => {
					setLoading(true);
					router.push(`/forwarder?skip=${Math.floor((page - 1) * props.take)}&take=${take}`);
				}}
			/>
			<NumberInput
				disabled={loading}
				defaultValue={take}
				w={'70'}
				onChange={e => setTake(+e)}
				onBlur={() => {
					setLoading(true);
					router.push(`/forwarder?skip=${props.current}&take=${take}`);
				}}
			/>
		</div>
	);
}

export default ForwardPagination;
