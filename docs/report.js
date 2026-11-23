const modes = ["sample", "live", "ideas"];
const briefTextFields = ["recipient", "occasion", "interests", "region", "exclude"];
const giftTextFields = ["name", "category", "reason", "caveat"];

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isAmount = (value) => value === null || (Number.isFinite(value) && value >= 0);
const isText = (value) => typeof value === "string";

function isDate(value) {
  if (value === null) return true;
  if (!isText(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function productUrl(value) {
  if (!isText(value) || !/^https:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function shoppingThumbnail(value) {
  const url = productUrl(value);
  return url && /^encrypted-tbn\d*\.gstatic\.com$/.test(url.hostname) && !url.port ? url : null;
}

export function validBrief(brief) {
  return isRecord(brief) && briefTextFields.every((field) => isText(brief[field]))
    && isAmount(brief.budget) && isText(brief.currency) && /^[A-Z]{3}$/.test(brief.currency)
    && isDate(brief.neededBy);
}

export function validGift(gift, mode) {
  return isRecord(gift) && giftTextFields.every((field) => isText(gift[field]))
    && Boolean(gift.name.trim() && gift.reason.trim())
    && isAmount(gift.price) && (gift.merchant === null || isText(gift.merchant))
    && (gift.url === null || productUrl(gift.url))
    && (gift.imageUrl === undefined || shoppingThumbnail(gift.imageUrl))
    && (mode !== "live" || Boolean(gift.url && gift.merchant?.trim()));
}

function validLead(lead) {
  return isRecord(lead) && isText(lead.name) && Boolean(lead.name.trim())
    && isText(lead.review) && Boolean(lead.review.trim())
    && typeof lead.fromShopping === "boolean"
    && (lead.merchant === null || isText(lead.merchant))
    && (lead.listedPrice === undefined || (lead.fromShopping && isText(lead.listedPrice)))
    && (lead.imageUrl === undefined || shoppingThumbnail(lead.imageUrl))
    && (lead.url === null || productUrl(lead.url));
}

export function validateReport(report) {
  if (!isRecord(report) || report.version !== 1 || !modes.includes(report.mode)
      || !validBrief(report.brief) || !isDate(report.checkedOn)
      || (report.mode === "live" && !report.checkedOn)
      || (report.discovery !== undefined && !isText(report.discovery))
      || (report.leads !== undefined && (!Array.isArray(report.leads) || !report.leads.every(validLead)))
      || !Array.isArray(report.notes) || !report.notes.every(isText)
      || !Array.isArray(report.gifts) || !report.gifts.every((gift) => validGift(gift, report.mode))) {
    throw new Error("Choose a valid Gift Search v2 report (version 1 JSON).");
  }
  return report;
}

export function formatMoney(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
}
