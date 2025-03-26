import {Payment, PrismaClient} from "@prisma/client";
import {ClonerParams} from "@/app/clone/[id]/[spyBot]/[sourceServer]/[copierBot]/[targetServer]/clone/cloner";
import {getBot, isDiscordClient} from "@/core/bot/client";
import {handlePlanPayment} from "@/app/plan/action";
import CryptoPayment from "@/app/plan/CryptoPayment";

declare global {
	var instance: PrismaClient;
	var prisma: typeof _prisma;
}

const instance: PrismaClient = global?.instance ?? new PrismaClient();
global.instance = instance;

const _prisma = instance.$extends({
	result: {
		bot: {
			key: {
				needs: {
					type: true,
					id: true
				},
				compute(params) {
					return `${params.type}|${params.id}` as const
				}
			}
		},
		cloneTask: {
			params: {
				needs: {
					params: true
				},
				compute({params}) {
					return params as unknown as typeof ClonerParams;
				}
			},
			sourceGuild: {
				needs: {
					params: true
				},
				compute({params}) {
					return async ()=> {
						const client = await getBot((params as any).spyBot);
						if (isDiscordClient(client)) {
							return client.guilds.fetch((params as any).sourceServer).catch(()=>undefined);
						}
						return undefined;
					}
				}
			},
			destinationGuild: {
				needs: {
					params: true
				},
				compute({params}) {
					return async () => {
						const client = await getBot((params as any).copierBot);
						if (isDiscordClient(client)) {
							return client.guilds.fetch((params as any).targetServer).catch(()=>undefined);
						}
						return undefined;
					}
				}
			}
		}
	},
	model: {
		payment: {

			async delete(id: string) {
				await this.status(id, "NOT_PAID");
				await instance.payment.delete({where: {id}})
			},
			async status(id: string,status: Payment['status']) {
				const key = id.startsWith("INV") ? "token":'id';
				const where = {
					[key]: id
				} as any;

				const payment = await instance.payment.findUnique({
					where,
					include: {
						plan: true
					}
				})

				if (!payment) throw(`Invalid Payment id ${id}`);

				if (status !== "PAID" && payment.status === 'NOT_PAID') {
					await CryptoPayment.cancelPayment(payment.token);
				}

				if (payment.status === status) {
					const {plan:_,..._payment} = payment;
					return _payment;
				}

				await handlePlanPayment(payment,status);

				return instance.payment.update({
					where,
					data: {
						status
					}
				})
			},
			update() {throw("GONE")},
			deleteMany() {throw("GONE")}
		}
	}
});
if (!global.prisma) console.log("DB INITIALIZED");
global.prisma = _prisma;

//@ts-ignore
export type PrismaModelType<T extends keyof typeof prisma> = Awaited<ReturnType<(typeof prisma[T])['findUniqueOrThrow']>>


export default _prisma;
