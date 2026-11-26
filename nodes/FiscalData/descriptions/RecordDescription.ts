import type { INodeProperties } from 'n8n-workflow';

const showForRecord = { resource: ['record'], operation: ['getAll'] };
const fieldDependencies = ['endpointSource', 'dataset', 'endpoint', 'endpointPath'];

export const recordOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['record'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many records',
				description: 'Get records from a dataset endpoint as JSON items or as a CSV/XML file',
			},
		],
		default: 'getAll',
	},
];

export const recordFields: INodeProperties[] = [
	{
		displayName: 'Endpoint Source',
		name: 'endpointSource',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForRecord },
		options: [
			{
				name: 'From List',
				value: 'list',
				description: 'Select a dataset and one of its endpoints',
			},
			{
				name: 'By Path',
				value: 'path',
				description: 'Type the endpoint path, e.g. /v2/accounting/od/debt_to_penny',
			},
		],
		default: 'list',
	},
	{
		displayName: 'Dataset Name or ID',
		name: 'dataset',
		type: 'options',
		required: true,
		typeOptions: { loadOptionsMethod: 'getDatasets' },
		displayOptions: { show: { ...showForRecord, endpointSource: ['list'] } },
		default: '',
		description:
			'The Fiscal Data dataset. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Endpoint Name or ID',
		name: 'endpoint',
		type: 'options',
		required: true,
		typeOptions: { loadOptionsMethod: 'getEndpoints', loadOptionsDependsOn: ['dataset'] },
		displayOptions: { show: { ...showForRecord, endpointSource: ['list'] } },
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Endpoint Path',
		name: 'endpointPath',
		type: 'string',
		required: true,
		displayOptions: { show: { ...showForRecord, endpointSource: ['path'] } },
		default: '',
		placeholder: '/v2/accounting/od/debt_to_penny',
		description:
			'Endpoint path relative to https://api.fiscaldata.treasury.gov/services/api/fiscal_service. A full URL is also accepted.',
	},
	{
		displayName: 'Output Format',
		name: 'format',
		type: 'options',
		displayOptions: { show: showForRecord },
		options: [
			{
				name: 'JSON',
				value: 'json',
				description: 'Return the records as n8n items',
			},
			{
				name: 'CSV File',
				value: 'csv',
				description: 'Return the records as a binary CSV file',
			},
			{
				name: 'XML File',
				value: 'xml',
				description: 'Return the records as a binary XML file',
			},
		],
		default: 'json',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: { show: showForRecord },
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: { show: { ...showForRecord, returnAll: [false] } },
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Field Names or IDs',
		name: 'fields',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getFields', loadOptionsDependsOn: fieldDependencies },
		displayOptions: { show: showForRecord },
		default: [],
		description:
			'Fields (columns) to return. Leave empty to return all fields. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'fixedCollection',
		placeholder: 'Add Filter',
		typeOptions: { multipleValues: true },
		displayOptions: { show: showForRecord },
		default: {},
		description: 'Conditions the records must match. All conditions are combined with AND.',
		options: [
			{
				displayName: 'Conditions',
				name: 'conditions',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getFields',
							loadOptionsDependsOn: fieldDependencies,
						},
						default: '',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					},
					{
						displayName: 'Operator',
						name: 'operator',
						type: 'options',
						options: [
							{ name: 'Equal', value: 'eq' },
							{ name: 'Greater Than', value: 'gt' },
							{ name: 'Greater Than or Equal', value: 'gte' },
							{ name: 'In List', value: 'in' },
							{ name: 'Less Than', value: 'lt' },
							{ name: 'Less Than or Equal', value: 'lte' },
						],
						default: 'eq',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						placeholder: 'e.g. 2024-01-01',
						description:
							'Value to compare with. Dates use the YYYY-MM-DD format. For "In List", separate the values with commas.',
					},
				],
			},
		],
	},
	{
		displayName: 'Sort',
		name: 'sort',
		type: 'fixedCollection',
		placeholder: 'Add Sort Rule',
		typeOptions: { multipleValues: true, sortable: true },
		displayOptions: { show: showForRecord },
		default: {},
		description:
			'Order of the results. By default the API sorts by the first column, usually the record date.',
		options: [
			{
				displayName: 'Rules',
				name: 'rules',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getFields',
							loadOptionsDependsOn: fieldDependencies,
						},
						default: '',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					},
					{
						displayName: 'Direction',
						name: 'direction',
						type: 'options',
						options: [
							{ name: 'Ascending', value: 'asc' },
							{ name: 'Descending', value: 'desc' },
						],
						default: 'desc',
					},
				],
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: { show: showForRecord },
		default: {},
		options: [
			{
				displayName: 'Convert Types',
				name: 'convertTypes',
				type: 'boolean',
				displayOptions: { show: { '/format': ['json'] } },
				default: true,
				description:
					'Whether to convert numeric fields to numbers and "null" strings to null. The API returns every value as a string.',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				displayOptions: { show: { '/format': ['csv', 'xml'] } },
				default: '',
				placeholder: 'e.g. debt_to_penny.csv',
				description:
					'Name of the output file. Defaults to the endpoint name plus the current date.',
			},
			{
				displayName: 'Output Mode',
				name: 'outputMode',
				type: 'options',
				displayOptions: { show: { '/format': ['json'] } },
				options: [
					{
						name: 'One Item per Record',
						value: 'records',
					},
					{
						name: 'Single Item With Data and Metadata',
						value: 'single',
						description:
							'Return one item with the records in a "data" array plus the response metadata',
					},
				],
				default: 'records',
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 10000 },
				default: 1000,
				description:
					'Number of records requested per API call (page[size]). The node paginates automatically.',
			},
			{
				displayName: 'Put Output File in Field',
				name: 'binaryPropertyName',
				type: 'string',
				displayOptions: { show: { '/format': ['csv', 'xml'] } },
				default: 'data',
				hint: 'The name of the output binary field to put the file in',
			},
			{
				displayName: 'Raw Filter',
				name: 'rawFilter',
				type: 'string',
				default: '',
				placeholder: 'e.g. record_date:gte:2024-01-01,country:in:(Canada,Mexico)',
				description:
					'Filter expression in the API syntax (field:operator:value, comma-separated). It is combined with the Filters above.',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				typeOptions: { minValue: 1000 },
				default: 60000,
				description: 'Maximum time to wait for each API response, in milliseconds',
			},
		],
	},
];
