import {Button, Select, Table} from "@mantine/core";
import {getBot} from "@/core/bot/client";
import {
	CloneTaskHandler,
	getCloneHandler
} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";
import {ssr} from "@/prisma/utils";
import {TaskStatus} from "@prisma/client";
import {revalidatePath} from "next/cache";
import Link from "next/link";

async function Page(props: any) {
	const tasks = await prisma.cloneTask.findMany();


	return (
		<div>
			<Link href={'/clone/new'}>
				<Button>
					New Clone
				</Button>
			</Link>
			<br/>
			<br/>
			<Table
				data={{
					head: ['From', "To", "Action Complete","End at", "Status","Action"],
					body: await Promise.all(tasks.map(async task => {
						const [source,destination] = await Promise.all([
							task.sourceGuild().catch(()=>undefined),
							task.destinationGuild().catch(()=>undefined)
						]);
						if (!source || !destination) return [];
						const handler = getCloneHandler(task);
						task.status = handler?.task?.status || "STOPPED";
						task = ssr(task);

						return [
							source?.name || "Unknown Server",
							destination?.name || "Unknown Server",
							handler.percent+"%",
							handler?.endAt || "Ended",
							task.status,
							<div className={'flex gap-2 items-end'}>
								<Select label={'Change Status'} defaultValue={task.status} data={Object.values(TaskStatus)} onChange={async(e)=>{
									'use server';
									if (!e) return;

									getCloneHandler(task).status = e as TaskStatus;
									revalidatePath("./");
								}} placeholder={'Change Status'} size={'xs'} />
								<Link href={`/clone/${task.id}`}>
									<Button size={'xs'}>
										{task.status === "RUNNING" ? "Log":"Edit"}
									</Button>
								</Link>
								<Button onClick={async()=>{
									'use server';
									await prisma.cloneTask.delete({where: {id: task.id}});
									revalidatePath("./")
								}} color={'red'} size={'xs'}>
									Del
								</Button>
							</div>
						]
					}))
				}}
			/>
		</div>
	);
}

export default Page;
