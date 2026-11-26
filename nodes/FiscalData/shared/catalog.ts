import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { DATASETS, type CatalogDataset, type CatalogEndpoint } from '../catalog';
import { normalizeEndpointPath } from './transport';

export const DATASET_PAGE_BASE_URL = 'https://fiscaldata.treasury.gov/datasets';

export function findDataset(id: string): CatalogDataset | undefined {
	return DATASETS.find((ds) => ds.id === id);
}

export function findEndpoint(
	path: string,
): { dataset: CatalogDataset; endpoint: CatalogEndpoint } | undefined {
	if (!path) return undefined;
	const normalized = normalizeEndpointPath(path);
	for (const dataset of DATASETS) {
		const endpoint = dataset.endpoints.find((ep) => ep.path === normalized);
		if (endpoint) return { dataset, endpoint };
	}
	return undefined;
}

export function endpointToJson(dataset: CatalogDataset, endpoint: CatalogEndpoint): IDataObject {
	return {
		datasetId: dataset.id,
		datasetTitle: dataset.title,
		endpoint: endpoint.path,
		url: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service${endpoint.path}`,
		tableName: endpoint.name,
		description: endpoint.description,
		earliestDate: endpoint.earliestDate,
		latestDate: endpoint.latestDate,
		fields: endpoint.fields.map(([name, label, dataType]) => ({ name, label, dataType })),
	};
}

export function datasetToJson(dataset: CatalogDataset, includeFields: boolean): IDataObject {
	return {
		id: dataset.id,
		title: dataset.title,
		description: dataset.description,
		updateFrequency: dataset.updateFrequency,
		url: `${DATASET_PAGE_BASE_URL}${dataset.path.startsWith('/') ? '' : '/'}${dataset.path}`,
		endpoints: dataset.endpoints.map((ep) => {
			const json = endpointToJson(dataset, ep);
			delete json.datasetId;
			delete json.datasetTitle;
			if (!includeFields) json.fields = ep.fields.map(([name]) => name);
			return json;
		}),
	};
}

function currentEndpointPath(this: ILoadOptionsFunctions): string {
	const source = this.getCurrentNodeParameter('endpointSource') as string | undefined;
	const value =
		source === 'path'
			? (this.getCurrentNodeParameter('endpointPath') as string | undefined)
			: (this.getCurrentNodeParameter('endpoint') as string | undefined);
	return typeof value === 'string' ? value : '';
}

export async function getDatasets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	return DATASETS.map((ds) => ({
		name: ds.title,
		value: ds.id,
		description: `${ds.description} (${ds.endpoints.length} endpoint${ds.endpoints.length === 1 ? '' : 's'})`,
	}));
}

export async function getEndpoints(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const datasetId = this.getCurrentNodeParameter('dataset') as string | undefined;
	const dataset = datasetId ? findDataset(datasetId) : undefined;
	if (!dataset) return [];
	return dataset.endpoints.map((ep) => ({
		name: ep.name,
		value: ep.path,
		description: `${ep.path} — ${ep.description}`,
	}));
}

export async function getFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const found = findEndpoint(currentEndpointPath.call(this));
	if (!found) return [];
	return found.endpoint.fields.map(([name, label, dataType]) => ({
		name: `${label} (${name})`,
		value: name,
		description: dataType,
	}));
}
