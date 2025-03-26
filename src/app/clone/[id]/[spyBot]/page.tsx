import SelectDiscordGuild from "../SelectDiscordGuild";

async function Page(props: any) {
	const sourceBot = decodeURIComponent((await props.params).spyBot) as any;
	return (
		<SelectDiscordGuild botKey={sourceBot} title={'Select Copy Source Server'} />
	);
}

export default Page;
