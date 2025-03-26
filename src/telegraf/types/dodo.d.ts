import { Context, NarrowedContext } from 'telegraf';
import {Message, Update} from 'telegraf/typings/core/types/typegram';
import ChannelPostUpdate = Update.ChannelPostUpdate;
import {GetEvent} from "@/core/bot/event/events.handler";

export type TheMessageContext = GetEvent<'channel_post'> | (GetEvent<'edited_channel_post'>)
