import {NextResponse} from "next/server";
const prisma = global.instance;


export const BackupTable = {
	bots: "bot",
	channels: "forwardChannel",
	actions: "forwardAction",
	destinations: "forwardActionDestination",
	plans: "plan",
	payments: "payment",
	tasks: "cloneTask"
} as const

export async function GET() {
	const data = await Promise.all(Object.entries(BackupTable).map(async ([key,table]) => {
		return [
			key,
			await prisma[table as "bot"].findMany()
		] as const
	}));

	return NextResponse.json( Object.fromEntries(data))
}
