import Discord, {ClientEvents} from "discord.js";
import CustomTelegraf from "../../../telegraf/CustomTelegraf";
import {Context} from "telegraf";

import {Update} from "@telegraf/types/update";
import {PropOr} from "telegraf/typings/core/helpers/deunionize";
import {Deunionize} from "telegraf/src/core/helpers/deunionize";
import {FilteredContext} from "telegraf/typings/context";

export default class ClientEventHandler<T extends CustomTelegraf | Discord.Client> {
	client: T
	constructor(client: T) {
		this.client = client;
	}

}

export function SetEvent<T extends CustomTelegraf | Discord.Client>(
	eventKey: T extends Discord.Client ? keyof ClientEvents : Parameters<typeof CustomTelegraf.on>[0]
) {
	return function (target: any, key: any) {
		if (!target[key]) {
			throw new Error(`Method ${String(key)} does not exist on the target.`);
		}

		target[key].event = eventKey;
	};
}

export type GetEvent<
	T extends Parameters<typeof CustomTelegraf.on>[0] | keyof ClientEvents
> = T extends keyof ClientEvents
	? ClientEvents[T]
	//@ts-ignore
	:  FilteredContext<any,T>;
