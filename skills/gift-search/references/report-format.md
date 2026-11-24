# Dashboard report

Save one UTF-8 JSON object that follows [report.schema.json](report.schema.json). Keep the `brief` as used in the run, including assumptions. Set `mode` to `live` for searched listings or `ideas` when offering unsourced suggestions. The dashboard reserves `sample` for its example catalog.

- Use an ISO 4217 currency code in `brief.currency`. All numeric prices must use that currency. A missing budget or unknown price is `null`.
- Set `brief.comparePriceBands` to `true` when the user requests the USD price comparison. The dashboard groups known item prices into under $25, $25–$50, and over $50 through $100.
- Set `checkedOn` to the date searched (`YYYY-MM-DD`) or `null` for ideas. Use the same date format for `brief.neededBy`.
- Put `gifts` in rank order and use one entry per product. A live gift needs an HTTPS product page in `url`, an identified retailer in `merchant`, and evidence for anything stated in `caveat`. Use `null` for unavailable merchant and URL values on idea cards.
- The dashboard may include an optional `imageUrl` for a Google Shopping thumbnail. Omit it when no matching thumbnail is available.
- Summarize assumptions and search limitations in `notes`. An empty gift list is valid.
