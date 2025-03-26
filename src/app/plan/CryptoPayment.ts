
import {
	InvoiceCreationType,
	InvoiceInformation,
	InvoiceNotification
} from "./CryptoPayment.types";

declare global {
	var CryptoPaymentHandler: ReturnType<typeof setInterval>
	var CryptoPaymentHandlerChecking: boolean
}
global.CryptoPaymentHandler ||= setInterval(async ()=>{
	if (global.CryptoPaymentHandlerChecking) return;
	global.CryptoPaymentHandlerChecking = true;

	const notPaid = await prisma.payment.findMany({
		where: {
			status: "NOT_PAID"
		}
	}).catch(()=>[]);

	for (let payment of notPaid) {
		try {
			const check = await CryptoPayment.paidCheck(payment.token).catch(()=>false);
			if (!check) {
				const ex = new Date(payment.created_at);
				ex.setMinutes(ex.getMinutes() + 30);

				if (ex.getTime() < Date.now()) {
					await CryptoPayment.cancelPayment(payment.token);
					await prisma.payment.delete(payment.id);
				}
			}
		} catch {
			console.error(`Fail to handle payment ${payment.userName} ${payment.planId}`);
		}
	}

	global.CryptoPaymentHandlerChecking = false;
}, 60000);

export default class CryptoPayment  {
	static apiToken = process.env['CRYPTO_API'];
	static shopId = process.env['CRYPTO_SHOP'];


	static async createPayment(price: number) {
		const invoice = (await CryptoPayment.fetch('https://api.cryptocloud.plus/v2/invoice/create', {
			amount: price,
			currency: "USD"
		})) as InvoiceCreationType

		return invoice.result;
	}

	static async fetch(url: string, body: any = {}) {
		if (!CryptoPayment.apiToken || !CryptoPayment.shopId) throw("CRYPTO_TOKEN and CRYPTO_SHOP Required in .env file");
		let init: RequestInit = {};
		init.headers ||= {} as unknown as typeof init.headers;
		type H = keyof HeadersInit;
		init.headers!['content-type' as H] ||= 'application/json';
		init.headers!['authorization' as H] ||= `Token ${CryptoPayment.apiToken}`;

		body['shop_id'] ||= this.shopId;
		init.body = JSON.stringify(body);
		init.method ||= 'POST';
		return fetch(url, init).then(r=>r.json())
	}

	static async cancelPayment(invoice: string) {
		return await CryptoPayment.fetch("https://api.cryptocloud.plus/v2/invoice/merchant/canceled", {
			uuid: invoice
		}).then((e)=>e.status === "success").catch(()=>false);
	}

	static async paidCheck(invoice: string) {
		const response = await CryptoPayment.fetch('https://api.cryptocloud.plus/v2/invoice/merchant/info', {
			uuids: [invoice]
		}) as InvoiceInformation;

		const info = response.result.shift();
		if (!info || !info.status?.includes("paid")) return false;

		return await prisma.payment.status(invoice,"PAID").then(()=>true).catch(()=>false)
	}
}
