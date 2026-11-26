import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { DATASETS } from './catalog';
import { datasetFields, datasetOperations } from './descriptions/DatasetDescription';
import { recordFields, recordOperations } from './descriptions/RecordDescription';
import { datasetToJson, findDataset, getDatasets, getEndpoints, getFields } from './shared/catalog';
import {
	fiscalDataJsonRequest,
	fiscalDataRequest,
	normalizeEndpointPath,
	type FiscalDataQuery,
	type ResponseFormat,
} from './shared/transport';
import { convertRecordTypes, mergeCsvPages, mergeXmlPages, splitCommaList } from './shared/utils';

const MAX_PAGE_SIZE = 10000;
const FILE_MIME_TYPES: Record<'csv' | 'xml', string> = { csv: 'text/csv', xml: 'application/xml' };

interface FilterCondition {
	field?: string;
	operator?: string;
	value?: string | number;
}

interface SortRule {
	field?: string;
	direction?: 'asc' | 'desc';
}

function buildFilter(conditions: FilterCondition[], rawFilter: string): string {
	const parts = conditions
		.filter((c) => c.field && c.operator)
		.map((c) => {
			let value = String(c.value ?? '').trim();
			if (c.operator === 'in' && !(value.startsWith('(') && value.endsWith(')'))) {
				value = `(${splitCommaList(value).join(',')})`;
			}
			return `${String(c.field).trim()}:${c.operator}:${value}`;
		});
	if (rawFilter.trim()) parts.push(rawFilter.trim());
	return parts.join(',');
}

function buildSort(rules: SortRule[]): string {
	return rules
		.filter((r) => r.field)
		.map((r) => `${r.direction === 'desc' ? '-' : ''}${String(r.field).trim()}`)
		.join(',');
}

export class FiscalData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Fiscal Data (U.S. Treasury)',
		name: 'fiscalData',
		icon: { light: 'file:icons/fiscaldata.png', dark: 'file:icons/fiscaldata.png' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Get federal finance data from the U.S. Treasury Fiscal Data API',
		defaults: {
			name: 'Fiscal Data',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Dataset',
						value: 'dataset',
						description: 'Information about the available datasets, endpoints and fields',
					},
					{
						name: 'Record',
						value: 'record',
						description: 'Data rows of a dataset endpoint',
					},
				],
				default: 'record',
			},
			...recordOperations,
			...recordFields,
			...datasetOperations,
			...datasetFields,
		],
	};

	methods = {
		loadOptions: {
			getDatasets,
			getEndpoints,
			getFields,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'dataset') {
					returnData.push(...executeDataset.call(this, operation, i));
				} else if (resource === 'record' && operation === 'getAll') {
					returnData.push(...(await executeRecordGetAll.call(this, i)));
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for resource "${resource}"`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				const nodeError =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				throw nodeError;
			}
		}

		return [returnData];
	}
}

function executeDataset(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): INodeExecutionData[] {
	const includeFields = this.getNodeParameter('includeFieldDetails', i, false) as boolean;

	if (operation === 'get') {
		const datasetId = this.getNodeParameter('dataset', i) as string;
		const dataset = findDataset(datasetId);
		if (!dataset) {
			throw new NodeOperationError(this.getNode(), `Dataset "${datasetId}" not found`, {
				itemIndex: i,
			});
		}
		return [{ json: datasetToJson(dataset, includeFields), pairedItem: { item: i } }];
	}

	if (operation === 'getAll') {
		const search = (this.getNodeParameter('search', i, '') as string).trim().toLowerCase();
		return DATASETS.filter((ds) => {
			if (!search) return true;
			const haystack = [
				ds.title,
				ds.description,
				...ds.endpoints.flatMap((ep) => [ep.name, ep.path]),
			]
				.join(' ')
				.toLowerCase();
			return haystack.includes(search);
		}).map((ds) => ({ json: datasetToJson(ds, includeFields), pairedItem: { item: i } }));
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported`, {
		itemIndex: i,
	});
}

async function executeRecordGetAll(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const endpointSource = this.getNodeParameter('endpointSource', i) as string;
	const rawPath =
		endpointSource === 'path'
			? (this.getNodeParameter('endpointPath', i) as string)
			: (this.getNodeParameter('endpoint', i) as string);
	if (!rawPath || !String(rawPath).trim()) {
		throw new NodeOperationError(this.getNode(), 'No endpoint selected', { itemIndex: i });
	}
	const endpointPath = normalizeEndpointPath(String(rawPath));

	const format = this.getNodeParameter('format', i) as ResponseFormat;
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
	const fields = splitCommaList(this.getNodeParameter('fields', i, []));
	const conditions =
		((this.getNodeParameter('filters', i, {}) as IDataObject).conditions as FilterCondition[]) ??
		[];
	const sortRules =
		((this.getNodeParameter('sort', i, {}) as IDataObject).rules as SortRule[]) ?? [];
	const options = this.getNodeParameter('options', i, {}) as IDataObject;

	const timeout = (options.timeout as number) ?? 60000;
	const pageSize = Math.max(
		1,
		Math.min(
			MAX_PAGE_SIZE,
			(options.pageSize as number) ?? 1000,
			Number.isFinite(limit) ? limit : MAX_PAGE_SIZE,
		),
	);

	const baseQuery: Omit<FiscalDataQuery, 'pageNumber' | 'pageSize'> = {
		fields: fields.join(','),
		filter: buildFilter(conditions, (options.rawFilter as string) ?? ''),
		sort: buildSort(sortRules),
	};

	if (format === 'json') {
		const convertTypes = (options.convertTypes as boolean) ?? true;
		const outputMode = (options.outputMode as string) ?? 'records';
		const records: IDataObject[] = [];
		let meta: IDataObject = {};
		let page = 1;
		let totalPages = 1;

		do {
			const response = await fiscalDataJsonRequest.call(
				this,
				endpointPath,
				{ ...baseQuery, pageNumber: page, pageSize },
				i,
				timeout,
			);
			const dataTypes = response.meta?.dataTypes ?? {};
			for (const record of response.data ?? []) {
				if (records.length >= limit) break;
				records.push(convertTypes ? convertRecordTypes(record, dataTypes) : record);
			}
			if (page === 1) {
				meta = {
					totalCount: response.meta?.['total-count'],
					labels: response.meta?.labels,
					dataTypes: response.meta?.dataTypes,
					dataFormats: response.meta?.dataFormats,
				};
			}
			totalPages = response.meta?.['total-pages'] ?? 1;
			if (!response.data?.length) break;
			page++;
		} while (page <= totalPages && records.length < limit);

		if (outputMode === 'single') {
			return [
				{
					json: { endpoint: endpointPath, count: records.length, meta, data: records },
					pairedItem: { item: i },
				},
			];
		}
		return records.map((record) => ({ json: record, pairedItem: { item: i } }));
	}

	// CSV / XML: ask the JSON API for the total row count first so we know how many pages to download.
	const countResponse = await fiscalDataJsonRequest.call(
		this,
		endpointPath,
		{ ...baseQuery, pageNumber: 1, pageSize: 1 },
		i,
		timeout,
	);
	const totalCount = Number(countResponse.meta?.['total-count'] ?? 0);
	const targetRows = Math.min(totalCount, limit);
	const pagesNeeded = Math.max(1, Math.ceil(targetRows / pageSize));

	const pages: string[] = [];
	for (let page = 1; page <= pagesNeeded; page++) {
		pages.push(
			await fiscalDataRequest.call(
				this,
				endpointPath,
				{ ...baseQuery, pageNumber: page, pageSize, format },
				i,
				timeout,
			),
		);
	}

	const merged =
		format === 'csv' ? mergeCsvPages(pages, targetRows) : mergeXmlPages(pages, targetRows);
	const endpointName = endpointPath.split('/').filter(Boolean).pop() ?? 'fiscaldata';
	const fileName =
		((options.fileName as string) ?? '').trim() ||
		`${endpointName}_${new Date().toISOString().slice(0, 10)}.${format}`;
	const binaryPropertyName = ((options.binaryPropertyName as string) ?? '').trim() || 'data';

	const binaryData = await this.helpers.prepareBinaryData(
		Buffer.from(merged.content, 'utf8'),
		fileName,
		FILE_MIME_TYPES[format],
	);

	return [
		{
			json: {
				endpoint: endpointPath,
				format,
				fileName,
				rowCount: merged.rowCount,
				totalCount,
			},
			binary: { [binaryPropertyName]: binaryData },
			pairedItem: { item: i },
		},
	];
}
