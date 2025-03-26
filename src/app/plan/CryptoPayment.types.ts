
export type InvoiceCreationType = {
	status: string
	result: {
		uuid: string
		created: string
		address: string
		expiry_date: string
		side_commission: string
		side_commission_cc: string
		amount: number
		amount_usd: number
		amount_in_fiat: number
		fee: number
		fee_usd: number
		service_fee: number
		service_fee_usd: number
		type_payments: string
		fiat_currency: string
		status: string
		is_email_required: boolean
		link: string
		invoice_id: any
		currency: {
			id: number
			code: string
			fullcode: string
			network: {
				code: string
				id: number
				icon: string
				fullname: string
			}
			name: string
			is_email_required: boolean
			stablecoin: boolean
			icon_base: string
			icon_network: string
			icon_qr: string
			order: number
		}
		project: {
			id: number
			name: string
			fail: string
			success: string
			logo: string
		}
		test_mode: boolean
	}
}

export type InvoiceNotification = {
	status: string
	invoice_id: string
	amount_crypto: string
	currency: string
	token: string
	invoice_info: string
}

export type InvoiceInformation = {
	status: string
	result: Array<{
		uuid: string
		address: string
		expiry_date: string
		side_commission: string
		side_commission_cc: string
		amount: number
		amount_usd: number
		received: number
		received_usd: number
		fee: number
		fee_usd: number
		service_fee: number
		service_fee_usd: number
		status: string
		order_id: string
		currency: {
			id: number
			code: string
			fullcode: string
			network: {
				code: string
				id: number
				icon: string
				fullname: string
			}
			name: string
			is_email_required: boolean
			stablecoin: boolean
			icon_base: string
			icon_network: string
			icon_qr: string
			order: number
		}
		project: {
			id: number
			name: string
			fail: string
			success: string
			logo: any
		}
		test_mode: boolean
	}>
}
