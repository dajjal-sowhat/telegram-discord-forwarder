import {getActionOfSource} from "./forwarder";
import Discord, {OmitPartialGroupDMChannel} from "discord.js";
import {TheMessageContext} from "../telegraf/types/dodo";

export type ActionType = NonNullable<Awaited<ReturnType<typeof getActionOfSource>>>

export type SupportedMessage =  OmitPartialGroupDMChannel<Discord.Message<boolean>> | TheMessageContext
