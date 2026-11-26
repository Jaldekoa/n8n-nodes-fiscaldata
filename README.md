# n8n-nodes-fiscaldata

This is an n8n community node. It lets you query the [U.S. Treasury Fiscal Data API](https://fiscaldata.treasury.gov/api-documentation/) in your n8n workflows.

Fiscal Data is the U.S. Department of the Treasury's open data site for federal finances: national debt, revenue and spending, interest rates, exchange rates, Treasury auctions and more. The API is free and needs no API key.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Usage](#usage)
[Updating the dataset catalog](#updating-the-dataset-catalog)
[Development](#development)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-fiscaldata`.

## Operations

The package contains one node, **Fiscal Data (U.S. Treasury)**, with two resources.

### Record → Get Many

Gets the rows of a dataset endpoint (table).

| Parameter | Description |
| --- | --- |
| Endpoint Source | **From List**: choose a *Dataset*, then one of its *Endpoints*. **By Path**: type the endpoint path (e.g. `/v2/accounting/od/debt_to_penny`) or the full URL. |
| Output Format | **JSON**: records as n8n items. **CSV File** or **XML File**: one item with a binary file. |
| Return All / Limit | Gets every matching record, or up to *Limit*. The node paginates automatically. |
| Fields | Columns to return (`fields=`). Leave empty for all columns. |
| Filters | Conditions `field` + operator (`eq`, `lt`, `lte`, `gt`, `gte`, `in`) + value, combined with AND (`filter=`). For `in`, separate the values with commas. |
| Sort | One or more fields, ascending or descending (`sort=`). |

**Options**

| Option | Description |
| --- | --- |
| Convert Types (JSON) | The API returns every value as text. When on (default), numeric columns become numbers and `"null"` becomes `null`. |
| Output Mode (JSON) | One item per record, or a single item with `data` (array) and `meta` (total count, labels, data types, formats). |
| File Name / Put Output File in Field (CSV/XML) | Name of the file and of its binary field (default `data`). |
| Page Size | Records per API call (`page[size]`, 1–10000, default 1000). |
| Raw Filter | Extra filter in API syntax, e.g. `record_date:gte:2024-01-01,country_currency_desc:in:(Canada-Dollar,Mexico-Peso)`. |
| Timeout (Ms) | Maximum wait per API call. |

For CSV and XML, the node first makes a small JSON call to get the total row count. It then downloads all the pages it needs and merges them into one file: a single header row for CSV, a single `<data>` block for XML.

### Dataset → Get / Get Many

Returns the node's catalog of datasets: description, update frequency, page on fiscaldata.treasury.gov, endpoints, date range and fields. Enable *Include Field Details* to add each field's label and data type. These operations make no API calls, so they are handy for exploring the data, or for an AI agent that uses this node as a tool.

## Credentials

None. The Fiscal Data API is public and needs no authentication.

## Usage

* **Latest national debt**: Record → Get Many, dataset *Debt to the Penny*, Limit `1`, Sort `record_date` descending.
* **Exchange rates for some currencies since 2024**: dataset *Treasury Reporting Rates of Exchange*, Filters `country_currency_desc` *In List* `Canada-Dollar,Mexico-Peso` and `record_date` *Greater Than or Equal* `2024-01-01`.
* **Download a whole table as CSV**: Output Format *CSV File*, Return All on. Then pass it to *Write Binary File*, Google Drive, S3, and so on.

Notes:

* Dates use the format `YYYY-MM-DD`.
* If you leave *Fields* empty on some endpoints, the API may aggregate (sum) rows. Pick the fields you need explicitly to get the raw rows.
* The API sometimes answers with temporary `503` errors or times out. The node retries up to 4 times with exponential backoff.

## Updating the dataset catalog

The list of datasets, endpoints and fields lives in `nodes/FiscalData/catalog.ts`. It is generated from the official metadata endpoint `https://api.fiscaldata.treasury.gov/services/dtg/metadata/`. To refresh it:

```bash
npm run generate:catalog
npm run build
```

You can always use an endpoint that is not in the catalog yet with **Endpoint Source → By Path**.

## Development

```bash
npm install
npm run dev     # starts n8n with the node loaded, at http://localhost:5678
npm run lint
npm run build
```

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Fiscal Data API documentation](https://fiscaldata.treasury.gov/api-documentation/)
* [Fiscal Data dataset search](https://fiscaldata.treasury.gov/datasets/)