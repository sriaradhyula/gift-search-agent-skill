import { formatMoney, productUrl } from "./report.js";

const shareTitles = { sample: "Sample gift ideas", live: "Verified gift shortlist", ideas: "Gift ideas" };
const singleLine = (value) => value?.replace(/\s+/g, " ").trim() ?? "";

function shareContent(report, gifts) {
  const leadsOnly = gifts.length === 0;
  const items = (leadsOnly ? report.leads ?? [] : gifts).map((item) => {
    const price = leadsOnly
      ? item.listedPrice && `Shopping estimate ${item.listedPrice}`
      : item.price === null ? "Price unknown" : `${formatMoney(item.price, report.brief.currency)} ${report.brief.currency}`;
    return {
      name: singleLine(item.name),
      details: [price, item.merchant].map(singleLine).filter(Boolean).join(" · "),
      note: leadsOnly ? singleLine(item.review) : [item.reason, item.caveat].map(singleLine).filter(Boolean).join(" "),
      url: productUrl(item.url)?.href,
    };
  });
  const status = {
    sample: "Illustrative products and prices.",
    live: `Listings checked ${report.checkedOn}. Prices and availability can change.`,
    ideas: "Shop availability and prices may need checking.",
  };
  return {
    items,
    title: leadsOnly ? "Gift research leads" : shareTitles[report.mode],
    context: leadsOnly ? "Unverified leads. Check price, stock, and delivery before buying." : status[report.mode],
  };
}

function shareText({ title, context, items }, checklist) {
  const blocks = items.map(({ name, details, note, url }) => {
    const label = [name, details].filter(Boolean).join(" — ");
    const safeLabel = checklist ? label.replace(/[\\[\]<>]/g, "\\$&") : label;
    const link = checklist && url ? `<${url}>` : url;
    return [`${checklist ? "- [ ]" : "•"} ${safeLabel}`, ...[note, link].filter(Boolean).map((line) => `  ${line}`)].join("\n");
  });
  const linkAdvice = items.some(({ url }) => url) ? "Inspect retailer link destinations before opening them." : "";
  return [title, context, linkAdvice, blocks.join("\n\n")].filter(Boolean).join("\n\n") + "\n";
}

function fitShareText(context, text, width) {
  if (context.measureText(text).width <= width) return text;
  const characters = Array.from(text.slice(0, 300));
  while (characters.length && context.measureText(characters.join("") + "…").width > width) characters.pop();
  return characters.join("").trimEnd() + "…";
}

function shareImage({ title, context, items }, checklist) {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const headerHeight = 230;
  const rowHeight = 138;
  const inset = 64;
  const visible = items.slice(0, Math.floor((8192 - headerHeight - 102) / rowHeight));
  const footer = items.length > visible.length
    ? `First ${visible.length} of ${items.length} items. Copy the list for all items.`
    : items.some(({ url }) => url) ? "Copy the list to share retailer links." : "";
  canvas.width = width;
  canvas.height = headerHeight + 46 + rowHeight * visible.length + (footer ? 56 : 0);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fcf4e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const banner = ctx.createLinearGradient(0, 0, width, headerHeight);
  banner.addColorStop(0, "#54102a");
  banner.addColorStop(1, "#8d2240");
  ctx.fillStyle = banner;
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.fillStyle = "#ffda92";
  ctx.fillRect(0, headerHeight - 5, width, 5);
  ctx.font = "bold 23px system-ui, sans-serif";
  ctx.fillText("GIFT SEARCH", inset, 66);
  ctx.font = "44px Georgia, serif";
  ctx.fillText("✦", width - inset - 44, 67);
  ctx.fillStyle = "#fff7e7";
  ctx.font = "bold 58px Georgia, serif";
  ctx.fillText(title, inset, 137);
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText(context, inset, 185);

  const contentLeft = inset + (checklist ? 68 : 25);
  const textWidth = width - inset - 25 - contentLeft;
  for (const [index, item] of visible.entries()) {
    const top = headerHeight + 28 + rowHeight * index;
    ctx.beginPath();
    ctx.roundRect(inset, top, width - inset * 2, rowHeight - 12, 16);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = "#e8d9c5";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (checklist) {
      ctx.strokeStyle = "#a32142";
      ctx.strokeRect(inset + 24, top + 27, 24, 24);
    }
    ctx.font = "bold 31px system-ui, sans-serif";
    ctx.fillStyle = "#29231f";
    const first = fitShareText(ctx, item.name, textWidth);
    const split = first === item.name ? -1 : first.lastIndexOf(" ");
    const lines = split > 0 ? [item.name.slice(0, split), fitShareText(ctx, item.name.slice(split + 1), textWidth)] : [first];
    for (const [lineIndex, line] of lines.entries()) {
      ctx.fillText(line, contentLeft, top + 43 + 34 * lineIndex);
    }
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillStyle = "#325746";
    ctx.fillText(fitShareText(ctx, item.details, textWidth), contentLeft, top + 43 + 34 * lines.length);
  }
  ctx.fillStyle = "#5c5147";
  ctx.font = "21px system-ui, sans-serif";
  if (footer) ctx.fillText(footer, inset, canvas.height - 30);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function enableShareResults(getResults, download) {
  const dialog = document.getElementById("share-dialog");
  const format = document.getElementById("share-format");
  const preview = document.getElementById("share-preview");
  const copy = document.getElementById("copy-share");
  const image = document.getElementById("download-share");
  const status = document.getElementById("share-status");
  let content;

  function updateSharePreview() {
    const checklist = format.value === "checklist";
    preview.value = shareText(content, checklist);
    copy.textContent = checklist ? "Copy checklist" : "Copy list";
    status.textContent = "";
  }

  document.getElementById("share-results").addEventListener("click", () => {
    const { report, gifts } = getResults();
    content = shareContent(report, gifts);
    updateSharePreview();
    dialog.showModal();
  });
  format.addEventListener("change", updateSharePreview);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(preview.value);
      status.textContent = "Copied to clipboard.";
    } catch {
      preview.focus();
      preview.select();
      status.textContent = "The text is selected. Copy it with your keyboard or device menu.";
    }
  });
  image.addEventListener("click", async () => {
    image.disabled = true;
    try {
      const png = await shareImage(content, format.value === "checklist");
      if (!png) throw new Error("Image export unavailable.");
      download(png, "gift-shortlist.png", "image/png");
      status.textContent = "PNG downloaded.";
    } catch {
      status.textContent = "Image export is unavailable. You can copy the list.";
    } finally {
      image.disabled = false;
    }
  });
}
