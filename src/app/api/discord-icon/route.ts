import { getBot, isDiscordClient } from "@/core/bot/client";
import { singleFlightFunc } from "@/prisma/utils";
import { NextRequest, NextResponse } from "next/server";

declare global {
    var GUILD_ICONS: Record<string, {
        buffer: ArrayBuffer,
        headers: any
    }>;
}
global.GUILD_ICONS ||= {};


const safeFetch = singleFlightFunc(async (...args: Parameters<typeof fetch>)=>{
    return fetch(...args);
},1000);

export async function GET(req: NextRequest) {
    global.GUILD_ICONS ||= {};
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const bot = await getBot(params.botId);
    if (!isDiscordClient(bot)) {
        return NextResponse.json({ error: "Invalid BotId" }, { status: 400 });
    }

    const channel = bot.channels.cache.get(params.channelId || params.id);
    if (!channel) {
        return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if ('guild' in channel) {
        const cache = global.GUILD_ICONS?.[channel.guild.id];
        if (cache) {
            return new Response(cache.buffer, {
                headers: cache.headers
            });
        }
        const url = channel.guild.iconURL({ size: 256, extension: 'png' }) || "http://127.0.0.1:3000/discord.png";
        const response = await safeFetch(url);
        const buffer = await response.arrayBuffer();
        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch icon" }, { status: 500 });
        }
        const headers = {
            'Content-Type': response.headers.get('Content-Type') || 'image/png',
            'Cache-Control': 'public, max-age=86400' // Cache for 1 day
        };
        global.GUILD_ICONS[channel.guild.id] = {
            buffer,
            headers
        };
        return new Response(buffer, {
            headers
        });
    } else {
        return NextResponse.json({ error: "Not a guild channel" }, { status: 400 });
    }
}