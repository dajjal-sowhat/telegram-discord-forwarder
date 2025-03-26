import {Button, NumberInput, TextInput} from "@mantine/core";
import {notFound, redirect} from "next/navigation";
import SelectGuildAndRole from "@/app/plan/[id]/SelectGuildAndRole";
import {revalidatePath} from "next/cache";
import {ssr} from "@/prisma/utils";

async function Page(props: any) {
	const id = (await props.params).id;
	const plan = await prisma.plan.findUnique({
		where: {
			id
		}
	}).then(ssr)
	const isNew = id === "new";

	if (!plan && !isNew) notFound();

	return (
		<div>
			<h2 className={'text-2xl'}>Manage Plan</h2>
			<br/>
			<form className={'max-w-[500px]'} action={async (e) => {
				'use server';

				const example = {
					name: 'test',
					price: '1',
					guild: '1269599684440096778',
					bot: '1269598514300583977',
					role: '1269599755978276990',
					days: 0
				};
				const data: typeof example = Object.fromEntries(Array.from(e.entries()).filter(([k]) => Object.keys(example).includes(k))) as any;
				const final = {
					...data,
					price: +data.price,
					botId: data.bot,
					bot: undefined,
					days: +data.days
				}
				await prisma.plan.upsert({
					where: {id: id+""},
					create: final,
					update: final
				});

				redirect("/plan");
			}}>
				<div className={'grid grid-cols-2 gap-3'}>
					<TextInput
						label={'Plan Name'}
						name={'name'}

						defaultValue={plan?.name}
					/>
					<NumberInput
						label={'Plan Price'}
						name={'price'}
						placeholder={'USD'}
						defaultValue={plan?.price}
					/>
					<NumberInput
						label={'Plan Days'}
						name={'days'}
						className={'col-span-full'}
						description={'Enter 0 for Non-Expire plan'}
						defaultValue={plan?.days || 30}
					/>
				</div>
				<br/>
				<div>
					<SelectGuildAndRole plan={plan || undefined} />
				</div>
				<br/>
				<Button type={'submit'}>
					Submit
				</Button>
			</form>
		</div>
	);
}

export default Page;
