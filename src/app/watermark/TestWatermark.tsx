'use client';

import {useState} from "react";
import {testWatermark} from "../action";
import {Button, TextInput} from "@mantine/core";

function TestWatermark(props: any) {
	const [image, setImage] = useState<string>("");
	const [url, setUrl] = useState(`${typeof window !== 'undefined' ? window.location.origin:""}/watermark.png`);
	const [loading, setLoading] = useState(false);

	return (
		<div>
			<h2 className={'text-2xl'}>Watermark Test</h2><br/>
			{image && <img alt={'test'} className={'w-full h-52 object-contain'} key={image.length} src={"data:image/png;base64, " + image}/>}
			<TextInput
				name={'url'}
				value={url}
				onChange={e => setUrl(e.target.value)}
				placeholder={'url'}
				label={'Enter Image Url'}
			/>
			<br/>
			<Button loading={loading} type={'submit'} onClick={() => {
				setLoading(true);
				const final = new URL(url);
				final.search = `?${Date.now()}`;
				testWatermark(final.toString()).then(setImage).then(()=>setLoading(false));
			}}>
				Test Watermark
			</Button>
		</div>
	);
}

export default TestWatermark;
