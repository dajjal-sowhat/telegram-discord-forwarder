import {Button, Select, Table, TextInput} from "@mantine/core";
import Discord from "discord.js";
import {BotType} from "@prisma/client";
import {redirect} from "next/navigation";
import {Bot, Prisma} from ".prisma/client";
import {getBot, getDiscordClientOptions, isDiscordClient, terminateClient} from "../../core/bot/client";
import CustomTelegraf from "../../telegraf/CustomTelegraf";
import {revalidatePath} from "next/cache";
import {ssr} from "../../prisma/utils";
import Refresher from "@/app/bots/Refresher";
import {PrismaModelType} from "@/prisma/PrismaClient";
import AddBotComponent from "@/app/bots/AddBotComponent";
import Link from "next/link";
import SsrButton from "@/app/bots/SsrButton";

async function Page(props: any) {
    const searchParams = await props.searchParams;
    const bots = await prisma.bot.findMany();


    return (
        <div>
            <details open={!!searchParams.msg}>
                <summary>
                    Add Bot
                </summary>
                <AddBotComponent/>
            </details>
            <Refresher/>
            <Table
                data={{
                    head: ['id', 'type', 'name', 'ready', "action"],
                    body: ssr(bots).map(bot => {
                        const client = INITIALIZED_CLIENTS[bot.key];
                        const isReady = client ? isDiscordClient(client) ? client.isReady() : client.ready : false;
                        return ([
                            bot.id,
                            bot.type,
                            bot.name,
                            !client ? "Stopped" : isReady ? "Ready" : "Waiting",
                            <div className={'flex gap-2 justify-start items-center'}>
                                <Link href={`/bots/${bot.id}`}>
                                    <Button>
                                        Edit
                                    </Button>
                                </Link>
                                <SsrButton onClick={async () => {
                                    'use server';

                                    if (!isReady) {
                                        await getBot(bot);
                                    } else {
                                        await terminateClient(bot);
                                    }
                                    revalidatePath("./")
                                }}>
                                    {isReady ? "Stop" : "Start"}
                                </SsrButton>
                                <SsrButton confirm onClick={async () => {
                                    'use server';

                                    await terminateClient(bot);
                                    await prisma.bot.delete({
                                        where: {
                                            id: bot.id
                                        }
                                    })
                                    revalidatePath("./")
                                }}>
                                    Delete
                                </SsrButton>
                            </div>
                        ]);
                    })
                }}
            />
        </div>
    );
}

export default Page;
