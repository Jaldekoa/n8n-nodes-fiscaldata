import {
	NodeApiError,
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type JsonObject,
} from 'n8n-workflow';

export const API_BASE_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

export type ResponseFormat = 'json' | 'csv' | 'xml';

export interface FiscalDataQuery {
	fields?: string;
	filter?: string;
	sort?: string;
	pageNumber: number;
	pageSize: number;
	format?: ResponseFormat;
}

export interface FiscalDataJsonResponse {
	data: IDataObject[];
	meta: {
		count: number;
		'total-count': number;
		'total-pages': number;
		labels?: IDataObject;
		dataTypes?: Record<string, string>;
		dataFormats?: IDataObject;
	};
	links?: IDataObject;
}

const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Builds the query string by hand: the API expects literal `page[number]`, `:` and `,` characters. */
export function buildQueryString(query: FiscalDataQuery): string {
	const parts: string[] = [];
	const encode = (value: string) =>
		encodeURIComponent(value)
			.replace(/%3A/gi, ':')
			.replace(/%2C/gi, ',')
			.replace(/%28/gi, '(')
			.replace(/%29/gi, ')');

	if (query.fields) parts.push(`fields=${encode(query.fields)}`);
	if (query.filter) parts.push(`filter=${encode(query.filter)}`);
	if (query.sort) parts.push(`sort=${encode(query.sort)}`);
	if (query.format && query.format !== 'json') parts.push(`format=${query.format}`);
	parts.push(`page%5Bnumber%5D=${query.pageNumber}`);
	parts.push(`page%5Bsize%5D=${query.pageSize}`);
	return parts.join('&');
}

export function normalizeEndpointPath(path: string): string {
	let p = path.trim();
	if (p.startsWith('http')) {
		const idx = p.indexOf('/services/api/fiscal_service');
		if (idx === -1) return p;
		p = p.slice(idx + '/services/api/fiscal_service'.length);
	}
	p = p.replace(/^\/?services\/api\/fiscal_service/, '');
	p = p.split('?')[0].replace(/\/+$/, '');
	return p.startsWith('/') ? p : `/${p}`;
}

function parseErrorBody(body: unknown): JsonObject {
	if (typeof body === 'string') {
		try {
			return JSON.parse(body) as JsonObject;
		} catch {
			const text = body.trim().startsWith('<')
				? 'The API returned an HTML error page'
				: body.trim();
			return { message: text.slice(0, 500) };
		}
	}
	if (body && typeof body === 'object') return body as JsonObject;
	return {};
}

/**
 * Performs a GET request against a Fiscal Data endpoint, retrying transient failures
 * (the API occasionally answers with 503 maintenance pages under load).
 */
export async function fiscalDataRequest(
	this: IExecuteFunctions,
	endpointPath: string,
	query: FiscalDataQuery,
	itemIndex: number,
	timeout: number,
): Promise<string> {
	const url = `${API_BASE_URL}${normalizeEndpointPath(endpointPath)}?${buildQueryString(query)}`;
	const format = query.format ?? 'json';
	const accept = { json: 'application/json', csv: 'text/csv', xml: 'application/xml' }[format];

	const options: IHttpRequestOptions = {
		method: 'GET',
		url,
		headers: { Accept: accept },
		json: false,
		encoding: 'text',
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		timeout,
	};

	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		let response: { statusCode: number; body: unknown };
		try {
			response = (await this.helpers.httpRequest(options)) as { statusCode: number; body: unknown };
		} catch (error) {
			// Network-level failure (timeout, DNS, connection reset): retry with backoff
			lastError = error;
			if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
			continue;
		}

		const body = typeof response.body === 'string' ? response.body : String(response.body ?? '');
		if (response.statusCode >= 200 && response.statusCode < 300) {
			return body;
		}

		const errorBody = parseErrorBody(body);
		if (RETRYABLE_STATUS.has(response.statusCode) && attempt < MAX_ATTEMPTS) {
			await sleep(1000 * 2 ** (attempt - 1));
			continue;
		}

		const hint =
			response.statusCode === 404
				? 'Check the endpoint path and that every field used in Fields, Filters and Sort exists in this endpoint.'
				: '';
		throw new NodeApiError(this.getNode(), errorBody, {
			itemIndex,
			httpCode: String(response.statusCode),
			message: (errorBody.error as string) ?? `Request failed with status ${response.statusCode}`,
			description: [(errorBody.message as string) ?? '', hint].filter(Boolean).join(' '),
		});
	}

	throw new NodeOperationError(
		this.getNode(),
		`Could not reach the Fiscal Data API: ${(lastError as Error)?.message ?? 'unknown error'}`,
		{ itemIndex },
	);
}

export async function fiscalDataJsonRequest(
	this: IExecuteFunctions,
	endpointPath: string,
	query: FiscalDataQuery,
	itemIndex: number,
	timeout: number,
): Promise<FiscalDataJsonResponse> {
	const body = await fiscalDataRequest.call(
		this,
		endpointPath,
		{ ...query, format: 'json' },
		itemIndex,
		timeout,
	);
	try {
		return JSON.parse(body) as FiscalDataJsonResponse;
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			'The Fiscal Data API returned a response that is not valid JSON',
			{
				itemIndex,
				description: body.slice(0, 300),
			},
		);
	}
}
