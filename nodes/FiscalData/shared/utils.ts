import type { IDataObject } from 'n8n-workflow';

const NUMERIC_TYPES = new Set([
	'INTEGER',
	'NUMBER',
	'CURRENCY',
	'CURRENCY0',
	'CURRENCY1',
	'CURRENCY3',
	'CURRENCY9',
	'PERCENTAGE',
	'PERCENTAGE_PRECISE',
	'YEAR',
	'QUARTER',
	'MONTH',
	'DAY',
]);

/**
 * The API returns every value as a string and nulls as the string "null".
 * Converts numeric columns to numbers and "null" to null, using the `meta.dataTypes` of the response.
 */
export function convertRecordTypes(
	record: IDataObject,
	dataTypes: Record<string, string> = {},
): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(record)) {
		if (value === 'null' || value === null || value === undefined) {
			result[key] = null;
			continue;
		}
		const type = (dataTypes[key] ?? '').toUpperCase();
		if (typeof value === 'string' && NUMERIC_TYPES.has(type)) {
			const trimmed = value.trim();
			const num = Number(trimmed);
			result[key] = trimmed !== '' && Number.isFinite(num) ? num : value;
		} else {
			result[key] = value;
		}
	}
	return result;
}

/** Splits CSV text into raw lines, respecting line breaks inside quoted values. */
export function splitCsvRows(csv: string): string[] {
	const rows: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < csv.length; i++) {
		const ch = csv[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			current += ch;
		} else if ((ch === '\n' || ch === '\r') && !inQuotes) {
			if (ch === '\r' && csv[i + 1] === '\n') i++;
			if (current.length > 0) rows.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	if (current.length > 0) rows.push(current);
	return rows;
}

/** Merges several CSV pages (each with its own header) into a single CSV, keeping at most `maxRows` data rows. */
export function mergeCsvPages(
	pages: string[],
	maxRows: number,
): { content: string; rowCount: number } {
	let header: string | undefined;
	const rows: string[] = [];
	for (const page of pages) {
		const lines = splitCsvRows(page.charCodeAt(0) === 0xfeff ? page.slice(1) : page);
		if (lines.length === 0) continue;
		if (header === undefined) header = lines[0];
		for (const line of lines.slice(1)) {
			if (rows.length >= maxRows) break;
			rows.push(line);
		}
	}
	return { content: [header ?? '', ...rows].join('\n') + '\n', rowCount: rows.length };
}

const DATA_ELEMENT_REGEX = /<data-element>[\s\S]*?<\/data-element>|<data-element\s*\/>/g;
const DATA_SECTION_REGEX = /<data>[\s\S]*?<\/data>|<data\s*\/>/;

/** Merges several XML pages into the first page's document, keeping at most `maxRows` <data-element> nodes. */
export function mergeXmlPages(
	pages: string[],
	maxRows: number,
): { content: string; rowCount: number } {
	if (pages.length === 0) return { content: '', rowCount: 0 };
	const elements: string[] = [];
	for (const page of pages) {
		for (const match of page.match(DATA_ELEMENT_REGEX) ?? []) {
			if (elements.length >= maxRows) break;
			elements.push(match);
		}
	}

	const first = pages[0];
	if (!DATA_SECTION_REGEX.test(first)) return { content: first, rowCount: elements.length };

	const dataSection =
		elements.length > 0 ? `<data>\n\t\t${elements.join('\n\t\t')}\n\t</data>` : '<data />';
	let content = first.replace(DATA_SECTION_REGEX, () => dataSection);
	content = content.replace(/<count>\d+<\/count>/, `<count>${elements.length}</count>`);
	return { content, rowCount: elements.length };
}

export function splitCommaList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean);
	}
	return [];
}
