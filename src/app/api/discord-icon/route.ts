import { getBot, isDiscordClient } from "@/core/bot/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const bot = await getBot(params.botId);
    if (!isDiscordClient(bot)) {
        return NextResponse.json({error: "Invalid BotId"}, { status: 400 });
    }

    const channel = bot.channels.cache.get(params.channelId || params.id);
    if (!channel) {
        return NextResponse.json({error: "Channel not found"}, { status: 404 });
    }

    if ('guild' in channel) {
        const url = channel.guild.iconURL({ size: 256, extension: 'png' }) || "http://127.0.0.1:3000/discord.png";
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json({error: "Failed to fetch icon"}, { status: 500 });
        }

        return new Response(response.body, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'image/png',
                'Cache-Control': 'public, max-age=86400' // Cache for 1 day
            }
        });
    } else {
        return NextResponse.json({error: "Not a guild channel"}, { status: 400 });
    }
}