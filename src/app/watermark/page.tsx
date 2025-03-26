import {Button, FileInput, NumberInput, TextInput} from "@mantine/core";
import * as fs from "fs";
import {revalidatePath} from "next/cache";
import * as Path from "node:path";
import TestWatermark from "@/app/watermark/TestWatermark";

const watermarkPathConfig = {
	viewPath: "/watermark.png",
	valuePath: Path.join(process.cwd(), "/public/watermark.png")
}

const vars = {
	watermarkX: 1,
	watermarkOpacity: 100,
	watermarkPathFile: "FILE",
	watermarkPath: `FILE_PATH:${watermarkPathConfig.valuePath}`
} as const

async function Page(props: any) {
	const config = await prisma.config.findMany()
			.then(e => Object.fromEntries(e.map(o => [o.key, o.value])))


	return (
		<div>

			<form action={async (form) => {
				'use server';
				let data = Object.fromEntries(Array.from(form.entries()).filter(([key]) => Object.keys(vars).includes(key)));

				const file = data.watermarkPathFile as File | undefined;
				if (file && file.size) {
					try {
						fs.rmSync(watermarkPathConfig.valuePath)
					} catch {
					}
					fs.writeFileSync(watermarkPathConfig.valuePath, await file.arrayBuffer().then(e => Buffer.from(e)));
					data.watermarkPath = watermarkPathConfig.valuePath;
				}

				for (let [key,_v] of Object.entries(data)) {
					if (typeof _v === 'object') continue;
					const value = _v+""
					await prisma.config.upsert({
						where: {
							key
						},
						update: {value},
						create:{key,value}
					})
				}

				revalidatePath("./")
			}}>


				<div className={'flex flex-col gap-5'}>
					{await Promise.all(Object.entries(vars).map(async ([key, value]) => {
						if (value === "FILE") return (
							<div>
								<FileInput key={key+Date.now()} label={key} name={key} />
							</div>
						)
						else if ((value+"").startsWith("FILE_PATH")){
							const [_,...paths] = (value+"").split(":")
							const path = paths.join(":");
							const file = await fs.promises.readFile(path).catch(()=>undefined);
							if (!file) return null;

							return (
								<div className={'flex items-center gap-2'}>
									<img alt={'Watermark'}
										className={'w-24 h-24 object-contain'}
										src={"data:image/png;base64, " + file?.toString('base64')}/>
									<Button onClick={async ()=>{
										'use server';

										await fs.promises.unlink(path);
										revalidatePath("./");
									}} color={'red'} size={'xs'}>
										Remove
									</Button>
								</div>
							)
						} else if (typeof value === 'number') {
							return (
								<NumberInput
									key={key}
									label={key}
									name={key}
									defaultValue={config[key] || value}
								/>
							)
						} else {
							return (
								<TextInput
									key={key}
									label={key}
									name={key}
									defaultValue={config[key] || value}
								/>
							)
						}
					}))}
				</div>
				<br/>
				<Button type={'submit'}>
					Submit
				</Button>
			</form>
			<br/>
			<TestWatermark />
		</div>
	);
}

export default Page;
