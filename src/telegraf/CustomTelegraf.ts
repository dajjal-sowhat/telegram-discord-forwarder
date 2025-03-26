import {Telegraf} from 'telegraf';
import {UserFromGetMe} from 'telegraf/types';
import {Bot} from ".prisma/client";
import {PrismaModelType} from "@/prisma/PrismaClient";


export default class CustomTelegraf extends Telegraf {
	readyEvents: (typeof this.onReady)[] = [];
	disconnectEvents: (typeof this.onDis)[] = [];
	me: UserFromGetMe | undefined;
	name: string;
	ready: boolean = false;
	stopped: boolean = false;
	id: string;
	bot: PrismaModelType<'bot'>;
	active: boolean = false;
	uniqKey: string | undefined;

	constructor(bot: PrismaModelType<'bot'>, token: string) {
		super(token);
		this.bot = bot;
		this.name = `${bot.type}/${bot.id}`;
		this.id = this.name.replaceAll(" ", "_") + Math.random();

		console.log(this.id, 'Initializing', 'Bot');
		this.telegram.getMe().then((me) => {
			this.me = me;
			this.launch(() => {
				this.onReady.bind(this)(me);
			}).catch((e) => {
				this.onDis.bind(this)(e, this)
			});
		}).catch((e) => {
			this.onDis.bind(this)(e, this)
		});
	}

	private onReady(bot: UserFromGetMe) {
		console.log(this.id,'Initialized')
		this.me = bot;

		for (const readyEvent of this.readyEvents) {
			try {
				readyEvent(bot);
			} catch (e) {
				console.error(`Error in Ready event[${bot.username}]`);
			}
		}

		this.ready = true;
	}

	stop(reason?: string) {
		this.stopped = true;
		super.stop(reason);
	}

	private onDis(e: Error, t: CustomTelegraf) {
		console.log(this.id, "Disconnected");
		console.error(e);
		for (let disconnectEvent of this.disconnectEvents) {
			try {
				disconnectEvent(e, t);
			} catch (e) {
				console.error(e);
			}
		}
		this.disconnectEvents = [];
	}

	public onDisconnect(e: (e: Error, T: this) => void) {
		this.disconnectEvents.push(e);
	}

	async waitToReady(): Promise<UserFromGetMe> {
		if (this.me) {
			return this.me;
		}

		return await new Promise((r,j) => {
			this.readyEvents.push((bot) => {
				r(bot);
			});
			this.onDisconnect(()=>j("DISCONNECTED"));
		});
	}
}
