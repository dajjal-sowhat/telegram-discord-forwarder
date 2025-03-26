import {Button, Table} from "@mantine/core";
import Link from "next/link";
import {getBot} from "@/core/bot/client";
import Discord from "discord.js";
import {revalidatePath} from "next/cache";
import CryptoPayment from "@/app/plan/CryptoPayment";
import {redirect} from "next/navigation";
import {createPayment} from "@/app/plan/action";
import ExportPlans from "@/app/plan/ExportPlans";

async function Page(props: any) {
	const plans = await prisma.plan.findMany({
		include: {
			_count: {
				select: {
					payments: true
				}
			}
		}
	});
	const payments = await prisma.payment.findMany({
		include: {
			plan: true
		},
		take: 10,
		orderBy: {
			created_at: "desc"
		}
	})

	return (
		<div>
			<div className="flex items-center gap-2">
				<Link href={'/plan/new'}>
					<Button>
						New Plan
					</Button>
				</Link>
				<ExportPlans plans={plans} />
			</div>
			<br/>
			<br/>
			<h1 className="text-3xl">Plans</h1>
			<Table
				data={{
					head: ['Name','Price', 'Role', 'Members', 'Action'],
					body: await Promise.all(plans.map(async plan => {
						const bot = await getBot(plan.botId) as Discord.Client;
						const guild = bot.guilds.cache.find(o=>o.id === plan.guild);
						const role = guild?.roles?.cache.find(o=>o.id === plan.role);


						return ([
							plan.name,
							plan.price.toLocaleString()+"$",
							(role?.name || "Not Found")+` (${guild?.name || "Unknown Server"})`,
							plan._count.payments+" Members",
							<div className={'flex gap-2'}>
								<Link href={`/plan/${plan.id}`}>
									<Button size={'xs'}>
										Edit
									</Button>
								</Link>
								<Button data-price={plan.price} size={'xs'} color={'orange'} onClick={async ()=>{
									'use server';

									await createPayment(plan, {
										userName: bot.bot.name+"(TEST)",
										userId: bot.bot.id
									});
									revalidatePath("./");
								}}>
									Test
								</Button>
								<Button color={'red'} size={'xs'} onClick={async ()=>{
									'use server';

									await prisma.plan.delete({where:{id: plan.id}});
									revalidatePath("./");
								}}>
									Del
								</Button>

							</div>
						])
					}))
				}}
			/>
			{!!payments.length && (
				<>
					<hr className={'my-10'}/>
					<h1 className="text-3xl">Payments</h1>
					<Table
						data={{
							head: ['User', "Plan", "Date","Status", "Invoice"],
							body: payments.map(payment => ([
								payment.userName,
								payment.plan.name+`(${payment.plan.price}$)`,
								payment.created_at.toLocaleString(),
								payment.status,
								payment.token,
								<div className={'flex items-center gap-3'}>
									<a target={'_blank'} href={`https://pay.cryptocloud.plus/${payment.token.split("-").at(-1)}?lang=en`}>
										<Button size={'xs'}>
											Open
										</Button>
									</a>
									<Button size={'xs'} onClick={async ()=>{
										'use server';
										await CryptoPayment.paidCheck(payment.token);
										revalidatePath("./")
									}}>
										Recheck
									</Button>
									<Button color={'red'} size={'xs'} onClick={async ()=>{
										'use server';
										await prisma.payment.delete(payment.id);
										revalidatePath("./");
									}}>
										Del
									</Button>
								</div>
							]))
						}}
					/>
				</>
			)}
		</div>
	);
}

export default Page;
