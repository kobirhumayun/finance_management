# Plan Limits Format

Subscription plans can persist per-tier quotas and feature flags in the `limits` field. The field is stored as a plain object on each `Plan` document and is interpreted dynamically by both the API and the client.

## Top-level structure

```jsonc
{
  "projects": {
    "maxActive": number | null
  },
  "transactions": {
    "perProject": number | null
  },
  "summary": {
    "allowFilters": boolean,
    "allowPagination": boolean
  }
}
```

All sections are optional. When a section or property is missing the application automatically falls back to the defaults listed below.

### Projects
- `maxActive`: Maximum number of active projects a user on this plan may create.
  - `null` means "no limit".

### Transactions
- `perProject`: Maximum number of transactions allowed per project.
  - Defaults to `1000` if omitted.
  - `null` means "no limit".

### Summary
- `allowFilters`: When `false`, the summary API strips all filter parameters and the client disables filter controls.
- `allowPagination`: When `false`, the summary API serves a single page of results and the client hides pagination.

Both properties default to `true`.

## Defaults

If no limits are supplied, or if individual fields are omitted, the following defaults apply:

| Section | Field | Default |
| --- | --- | --- |
| `projects` | `maxActive` | `null` (unlimited) |
| `transactions` | `perProject` | `1000` |
| `summary` | `allowFilters` | `true` |
| `summary` | `allowPagination` | `true` |

## Examples

- **Free plan**
  ```json
  {
    "projects": { "maxActive": 5 },
    "transactions": { "perProject": 1000 },
    "summary": { "allowFilters": false, "allowPagination": false }
  }
  ```

- **Professional plan (100 projects, filtering enabled)**
  ```json
  {
    "projects": { "maxActive": 100 },
    "transactions": { "perProject": 1000 },
    "summary": { "allowFilters": true, "allowPagination": true }
  }
  ```

- **Enterprise plan with unlimited projects and transactions**
  ```json
  {
    "projects": { "maxActive": null },
    "transactions": { "perProject": null },
    "summary": { "allowFilters": true, "allowPagination": true }
  }
  ```

Administrators can update these values through the plan management endpoints; the server sanitizes input and applies defaults before returning plan data to clients.
