import {NextResponse} from "next/server";
import prisma from "../../prisma/PrismaClient"

export async function GET() {
	const [channels ,actions, destinations] = await Promise.all([
		prisma.forwardChannel.findMany(),
		prisma.forwardAction.findMany(),
		prisma.forwardActionDestination.findMany()
	]);

	return NextResponse.json({
		channels,
		actions,
		destinations
	})
}
