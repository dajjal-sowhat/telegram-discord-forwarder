import SelectDiscordGuild from "@/app/clone/[id]/SelectDiscordGuild";

async function Page(props: any) {
	const copierBot = decodeURIComponent((await props.params).copierBot) as any;
	return (
		<SelectDiscordGuild botKey={copierBot} title={'Select Target Server'} />
	);
}

export default Page;
