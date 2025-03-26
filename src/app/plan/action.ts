'use server';

import CryptoPayment from "@/app/plan/CryptoPayment";
import {PrismaModelType} from "@/prisma/PrismaClient";
import {Payment} from "@prisma/client";
import {getBot, isDiscordClient} from "@/core/bot/client";
import Discord, {ButtonComponent, ChannelType} from "discord.js";

export async function createPayment(plan: PrismaModelType<'plan'>, data: { userName: string, userId: string }) {
	const invoice = await CryptoPayment.createPayment(plan.price);

	await prisma.payment.create({
		data: {
			planId: plan.id,
			...data,
			token: invoice.invoice_id ?? invoice.uuid
		}
	})

	return invoice;
}


export async function handlePlanPayment(payment: PrismaModelType<'payment'> & {
	plan: PrismaModelType<'plan'>
}, status: Payment['status']) {
	try {
		const {plan} = payment;
		const bot = await getBot(plan.botId);
		if (!isDiscordClient(bot)) throw ("Invalid Bot Id");
		const guild = await bot.guilds.fetch(plan.guild).catch(() => undefined);
		const [role, member] = await Promise.all([
			guild?.roles.fetch(plan.role),
			guild?.members.fetch(payment.userId)
		]);

		if (!guild || !role || !member) throw (`Required Params on target server not found (${guild?.name || "Unknown Server"}`)

		if (status === "PAID") {
			await member.roles.add(role, `${plan.name} PAID`);
		} else if (status === "NOT_PAID") {
			await member.roles.remove(role, `${plan.name} EXPIRED`).catch(() => undefined);
		}
	} catch (e: any) {
		console.error('Fail to handle payment status changes', e?.message ?? e)
	}
}


export async function handlePlanExport(data: { bot: string, channel: string, guild: string }) {
	const bot = await getBot(data.bot);
	if (!isDiscordClient(bot)) throw ("Invalid Client");

	const channel = await bot.channels.fetch(data.channel).catch(() => undefined);
	if (!channel || channel.type !== ChannelType.GuildText) throw ("Invalid Channel");


	let [webhook] = await channel.fetchWebhooks().then(e=>Array.from(e.values()));
	if (!webhook) {
		webhook = await channel.createWebhook({
			name: "Plans",
			avatar: channel.guild.iconURL()
		})
	}

	const plans = await prisma.plan.findMany({
		where: {
			botId: data.bot,
			guild: data.guild
		}
	});


	for (let plan of plans) {
		const row = new Discord.ActionRowBuilder()
			.addComponents(
				new Discord.ButtonBuilder()
					.setCustomId(`plan:${plan.id}`) // It is better to have a unique ID for the buttons
					.setLabel("Buy")
					.setStyle(Discord.ButtonStyle.Success), //PRIMARY, SECONDARY, ALERT or SUCCESS
			);

		const role = await channel.guild.roles.fetch(plan.role);
		const colors =  Object.values(Discord.Colors);

		await webhook.send({
			avatarURL: channel.guild.iconURL()!,
			username: channel.guild.name+" Plans",
			content: `# ${plan.name}`,
			embeds: [
				{
					title: plan.name,
					fields: [
						{
							name: "Time",
							value: plan.days < 0 ? "Life-Time" : `${plan.days}/days`,
							inline: true
						},
						{
							name: "Role",
							value: `${role?.toString()}`,
							inline: true
						},
						{
							name: "Payment",
							value: `BTC, TRX, TON...`,
							inline: true
						}
					],
					footer: {
						icon_url: channel.guild.icon || "",
						text: channel.guild.name
					},
					description: `# ${plan.price}$ Only`,
					color: role?.color || colors[Math.ceil(Math.random() * colors.length)]
				}
			],
			components: [row as any]
		})
	}
}
