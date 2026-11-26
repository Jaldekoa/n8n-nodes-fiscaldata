import type { INodeProperties } from 'n8n-workflow';

const showForDataset = { resource: ['dataset'] };

export const datasetOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForDataset },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a dataset',
				description: 'Get the description, endpoints and fields of a dataset',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many datasets',
				description: 'List the available datasets and their endpoints',
			},
		],
		default: 'getAll',
	},
];

export const datasetFields: INodeProperties[] = [
	{
		displayName: 'Dataset Name or ID',
		name: 'dataset',
		type: 'options',
		required: true,
		typeOptions: { loadOptionsMethod: 'getDatasets' },
		displayOptions: { show: { ...showForDataset, operation: ['get'] } },
		default: '',
		description:
			'The Fiscal Data dataset. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		displayOptions: { show: { ...showForDataset, operation: ['getAll'] } },
		default: '',
		placeholder: 'e.g. debt',
		description:
			'Only return datasets whose title, description, table names or endpoint paths contain this text (case-insensitive)',
	},
	{
		displayName: 'Include Field Details',
		name: 'includeFieldDetails',
		type: 'boolean',
		displayOptions: { show: showForDataset },
		default: false,
		description:
			'Whether to include the label and data type of every field. When disabled, only the field names are returned.',
	},
];
