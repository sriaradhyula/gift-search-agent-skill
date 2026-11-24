import { examples, runSample, sampleImage } from "./sample.js";
import { createDemoRun, demoScenarios } from "./demos.js";
import { formatMoney, giftThumbnailKey, productUrl, shoppingThumbnail, usdPriceBand, usdPriceBandLabels, usdPriceComparisonCap, validBrief, validateReport } from "./report.js";
import { consumeEvents, finishTeam, recentResearchNotes, replayTimeline, researchMemory, resetTeam, showTeamEvent, stopTeam } from "./team.js";
import { enableChat } from "./chat.js";
import { enableShareResults } from "./share.js";

const select = (id) => document.getElementById(id);
const form = select("gift-form");
const recipientChoice = select("recipient");
const customRecipient = select("custom-recipient");
const interestsInput = select("interests");
const budgetInput = select("budget");
const priceComparison = select("compare-price-bands");
const interestSuggestions = document.querySelectorAll("[data-interest]");
const surprise = select("surprise-brief");
const briefStatus = select("brief-status");
const cards = select("cards");
const sort = select("sort");
const demoMode = select("demo-mode");
const harnessChoice = select("run-harness");
const savedRuns = select("saved-runs");
const region = select("region");
const dialog = select("gift-detail");
const linkInspection = select("link-inspection");
const refineDialog = select("refine-dialog");
const refineForm = select("refine-form");
const demoChoice = select("demo-scenario");
const gridMount = document.querySelector('meta[name="gift-search-mount"]')?.content;
const wipedSessionKey = "gift-search-session-wiped";
const liveApi = (path) => `${gridMount ?? "."}/api/${path}`;
const reportFragment = "#report=";
const teamIntroduction = "";
const regionCurrencies = { US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", DE: "EUR", FR: "EUR", IN: "INR", JP: "JPY" };
const modeDescriptions = {
  sample: "Demo results",
  live: "Live results · Prices can change",
  ideas: "Unverified ideas",
};
const exampleBriefs = Object.values(examples);

let liveReady = false;
let report = runSample(readBrief());
let running = false;
let harnessMode = false;
let historyEnabled = false;
let retailerThumbnails = false;
let wipeEnabled = false;
let loadingRun = false;
let loadedRun;
let displayedRunId;
let refinementSource;
const harnessOptions = new Map();
let runAbort;
let lastRun;
let budgetBeforeComparison;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function price(gift) {
  return gift.price === null ? "Price unknown" : formatMoney(gift.price, report.brief.currency);
}

function inspectLink(destination) {
  const url = URL.parse(destination);
  if (!url || !["https:", "http:", "mailto:"].includes(url.protocol) || url.username || url.password) return;
  select("link-inspection-host").textContent = url.host || "Email link";
  select("link-inspection-url").textContent = url.href;
  select("open-inspected-link").href = url.href;
  linkInspection.showModal();
}

function inspectLinkButton(url, name, iconOnly = false) {
  const button = element("button", iconOnly ? "text-link inspect-card-link" : "text-link", iconOnly ? "ⓘ" : "ⓘ Inspect link");
  button.type = "button";
  button.title = "Inspect link";
  button.setAttribute("aria-label", `Inspect link for ${name}`);
  button.addEventListener("click", () => inspectLink(url));
  return button;
}

function openGift(gift) {
  select("detail-category").textContent = gift.category;
  select("detail-title").textContent = gift.name;
  select("detail-price").textContent = [price(gift), gift.merchant].filter(Boolean).join(" · ");
  select("detail-reason").textContent = gift.reason;
  const caveat = select("detail-caveat");
  caveat.textContent = gift.caveat;
  caveat.hidden = !gift.caveat;
  const inspect = select("detail-inspect");
  const url = productUrl(gift.url);
  inspect.hidden = !url;
  inspect.onclick = url ? () => inspectLink(url) : null;
  dialog.showModal();
}

function appendThumbnail(card, imageUrl, fallback) {
  const source = shoppingThumbnail(imageUrl)?.href ?? fallback;
  if (!source) return;
  const photo = element("img", "card-thumbnail");
  photo.alt = "";
  photo.loading = "lazy";
  photo.referrerPolicy = "no-referrer";
  photo.addEventListener("error", () => {
    if (fallback && photo.getAttribute("src") !== fallback) photo.src = fallback;
    else photo.remove();
  });
  photo.src = source;
  card.append(photo);
}

function buildCard(gift, heading = "h3") {
  const card = element("article", "gift-card");
  const image = report.mode === "sample" ? sampleImage(gift.name) : -1;
  if (image >= 0) {
    const photo = element("div", `card-photo photo-${image}`);
    photo.setAttribute("aria-hidden", "true");
    card.append(photo);
  }
  if (report.mode === "live") {
    const index = report.gifts.indexOf(gift);
    const fallback = retailerThumbnails && displayedRunId && gift.url && index >= 0 && index < 5
      ? liveApi(`runs/${encodeURIComponent(displayedRunId)}/gifts/${index}/thumbnail/${giftThumbnailKey(gift.url)}`) : undefined;
    appendThumbnail(card, gift.imageUrl, fallback);
  }

  const body = element("div", "card-body");
  const title = element(heading, "", gift.name);
  const category = element("p", "card-category", [gift.category, gift.merchant].filter(Boolean).join(" · "));
  const reason = element("p", "card-reason", gift.reason);
  const footer = element("div", "card-footer");
  const cost = element("span", "card-price", price(gift));
  const details = element("button", "text-link", "Details →");
  details.type = "button";
  details.setAttribute("aria-label", `Details for ${gift.name}`);
  details.addEventListener("click", () => openGift(gift));
  const actions = element("div", "card-actions");
  const url = productUrl(gift.url);
  if (url) actions.append(inspectLinkButton(url, gift.name, true));
  actions.append(details);
  footer.append(cost, actions);
  body.append(category, title, reason, footer);
  card.append(body);
  return card;
}

function buildLeadCard(lead) {
  const card = element("article", "gift-card");
  appendThumbnail(card, lead.imageUrl);
  const body = element("div", "card-body");
  const source = lead.fromShopping ? "Google Shopping" : "Web discovery";
  body.append(
    element("p", "card-category", [source, lead.merchant].filter(Boolean).join(" · ")),
    element("h3", "", lead.name),
  );
  if (lead.listedPrice) body.append(element("p", "card-reason", `Shopping estimate · ${lead.listedPrice}`));
  body.append(element("p", "card-reason", lead.review));
  const url = productUrl(lead.url);
  if (url) {
    const footer = element("div", "card-footer");
    footer.append(inspectLinkButton(url, lead.name));
    body.append(footer);
  }
  card.append(body);
  return card;
}

function sortedGifts() {
  if (sort.value === "recommended") return report.gifts;
  const direction = sort.value === "price-low" ? 1 : -1;
  return [...report.gifts].sort((first, second) => {
    if (first.price === null) return second.price === null ? 0 : 1;
    if (second.price === null) return -1;
    return direction * (first.price - second.price);
  });
}

function renderGiftCards() {
  const gifts = sortedGifts();
  const compare = report.brief.comparePriceBands === true;
  cards.classList.toggle("card-grid", !compare);
  if (!compare) {
    cards.replaceChildren(...gifts.map((gift) => buildCard(gift)));
    return;
  }
  const groups = usdPriceBandLabels.map((label, band) => ({ label, band }));
  if (sort.value === "price-high") groups.reverse();
  groups.push({ label: "Other gifts", band: null });
  cards.replaceChildren(...groups.flatMap(({ label, band }) => {
    const matches = gifts.filter(({ price }) => usdPriceBand(price) === band);
    if (!matches.length && (!gifts.length || band === 0 || band === null)) return [];
    const section = element("section", "price-band");
    section.append(element("h3", "", label));
    if (matches.length) {
      const grid = element("div", "card-grid");
      grid.replaceChildren(...matches.map((gift) => buildCard(gift, "h4")));
      section.append(grid);
    } else {
      const message = report.mode === "live" ? "No verified gifts in this range." : "No gifts in this range.";
      section.append(element("p", "price-band-empty", message));
    }
    return [section];
  }));
}

function render() {
  const { mode, brief, gifts, notes, checkedOn, discovery, leads = [] } = report;
  select("mode-description").textContent = checkedOn
    ? `Checked ${checkedOn} · Prices can change` : modeDescriptions[mode];
  select("results-display").hidden = mode === "sample" && !demoMode.checked && !form.hidden;
  const budget = brief.budget === null ? "" : ` · Up to ${formatMoney(brief.budget, brief.currency)} ${brief.currency}`;
  const details = [brief.recipient, brief.occasion].filter(Boolean).join(" · ");
  const resultType = mode === "live" ? (gifts.length === 1 ? "verified gift" : "verified gifts")
    : (gifts.length === 1 ? "idea" : "ideas");
  select("summary").textContent = [`${gifts.length} ${resultType}`, details].filter(Boolean).join(" · ") + budget;
  const discoveryStatus = select("discovery-status");
  discoveryStatus.hidden = !discovery;
  discoveryStatus.textContent = discovery ?? "";
  select("link-advice").hidden = ![...gifts, ...leads].some(({ url }) => productUrl(url));
  renderGiftCards();
  select("share-results").disabled = !gifts.length && !leads.length;
  select("research-leads").hidden = !leads.length;
  select("leads-summary").textContent = `${leads.length} research ${leads.length === 1 ? "lead" : "leads"}`;
  select("lead-cards").replaceChildren(...leads.map(buildLeadCard));
  select("empty").hidden = gifts.length > 0 || leads.length > 0;
  select("empty-title").textContent = mode === "live" ? "No verified gifts" : "No matching gifts";
  select("empty-message").textContent = mode === "sample"
    ? "Try another interest or budget."
    : "See run notes or try a broader search.";
  sort.disabled = gifts.length < 2;
  const notesList = select("run-notes");
  notesList.replaceChildren(...notes.map((note) => element("li", "", note)));
  notesList.hidden = !notes.length || (mode === "sample" && notes.length === 1 && notes[0] === examplesNote);
  select("run-details").hidden = !discovery && notesList.hidden;
}

const examplesNote = report.notes[0];

function message(text = "") {
  const banner = select("message");
  banner.hidden = !text;
  banner.textContent = text;
}

function searchesLive() {
  return liveReady && !demoMode.checked;
}

function updateSearchButton() {
  select("search-button").disabled = !searchesLive() && !demoMode.checked;
  select("search-label").textContent = running ? "Searching…" : demoMode.checked ? "Find sample gifts" : "Find gifts";
}

function updateMode() {
  const liveSearch = searchesLive();
  select("demo-controls").hidden = !demoMode.checked;
  select("region-field").hidden = !liveSearch;
  region.disabled = !liveSearch;
  updateBudgetCurrency();
  const showResearchTurns = harnessMode && liveSearch;
  select("harness-setting").hidden = !showResearchTurns;
  select("research-setting").hidden = !showResearchTurns;
  select("research-turns").disabled = !showResearchTurns;
  select("search-availability").hidden = liveSearch || demoMode.checked;
  select("search-history").hidden = !historyEnabled || !liveSearch;
  select("wipe-session").hidden = !wipeEnabled;
  updateChatVisibility();
  updateTeamActions();
  updateSearchButton();
}

function updateRecipient() {
  const custom = recipientChoice.value === "";
  select("custom-recipient-field").hidden = !custom;
  customRecipient.disabled = !custom;
}

const wipeDialog = select("wipe-dialog");
const confirmWipe = select("confirm-wipe");
select("wipe-session").addEventListener("click", () => {
  select("wipe-status").textContent = "";
  wipeDialog.showModal();
});
select("cancel-wipe").addEventListener("click", () => wipeDialog.close());
wipeDialog.addEventListener("cancel", (event) => {
  if (confirmWipe.disabled) event.preventDefault();
});
select("wipe-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (confirmWipe.disabled || !wipeEnabled) return;
  const cancel = select("cancel-wipe");
  const status = select("wipe-status");
  confirmWipe.disabled = cancel.disabled = true;
  status.textContent = "Wiping session…";
  try {
    const response = await fetch(liveApi("session/wipe"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const result = response.headers.get("Content-Type")?.includes("application/json") ? await response.json() : null;
    if (!response.ok || result?.wiped !== true) throw new Error(result?.error || "Session wipe failed. Try again.");
    try {
      sessionStorage.setItem(wipedSessionKey, "1");
    } catch {
      // Keep clearing the tab even when browser storage is unavailable.
    }
    history.replaceState(null, "", location.pathname);
    location.reload();
  } catch (error) {
    status.textContent = error.message || "Session wipe failed. Try again.";
    confirmWipe.disabled = cancel.disabled = false;
  }
});

function readBrief() {
  const destination = searchesLive() ? region.selectedOptions[0] : region.options[0];
  return {
    recipient: recipientChoice.value || customRecipient.value.trim(),
    occasion: select("occasion").value,
    interests: interestsInput.value.trim(),
    budget: budgetInput.valueAsNumber,
    currency: regionCurrencies[destination.value],
    region: destination.text,
    neededBy: select("neededBy").value || null,
    exclude: select("exclude").value.trim(),
    ...(priceComparison.checked && { comparePriceBands: true }),
  };
}

function updateBudgetCurrency() {
  const currency = regionCurrencies[searchesLive() ? region.value : "US"];
  select("budget-currency").textContent = currency;
  const inDollars = currency === "USD";
  budgetInput.min = inDollars ? budgetInput.defaultValue : "1";
  select("price-comparison-control").hidden = !inDollars;
  if (!inDollars && priceComparison.checked) {
    priceComparison.checked = false;
    updateBudgetLimit();
  }
}

function updateBudgetLimit() {
  if (priceComparison.checked) {
    budgetBeforeComparison = budgetInput.value;
    budgetInput.value = usdPriceComparisonCap;
  } else if (budgetBeforeComparison !== undefined) {
    budgetInput.value = budgetBeforeComparison;
    budgetBeforeComparison = undefined;
  }
  budgetInput.readOnly = priceComparison.checked;
}

function showReport(nextReport, runId) {
  report = nextReport;
  displayedRunId = runId;
  sort.value = "recommended";
  render();
}

function showSampleBrief(brief) {
  resetTeam(teamIntroduction);
  showReport(runSample(brief));
}

function showReportBrief(brief, focus) {
  const fields = [
    ["Recipient", brief.recipient],
    ["Occasion", brief.occasion],
    ["Interests", brief.interests],
    ["Max budget", brief.budget === null ? "" : `${formatMoney(brief.budget, brief.currency)} ${brief.currency}`],
    ["Ship to", brief.region],
    ["Needed by", brief.neededBy],
    ["Exclusions", brief.exclude],
    ["Research focus", focus],
  ];
  const list = select("report-brief-fields");
  list.replaceChildren(...fields.filter(([, value]) => value).map(([label, value]) => {
    const row = element("div");
    row.append(element("dt", "", label), element("dd", "", value));
    return row;
  }));
  form.hidden = true;
  surprise.hidden = true;
  briefStatus.textContent = "";
  select("report-brief").hidden = false;
}

function openReport(nextReport, saved) {
  const { brief } = validateReport(nextReport);
  resetTeam(teamIntroduction);
  showReportBrief(brief, saved?.refinementFocus);
  loadedRun = undefined;
  select("resume-run").hidden = true;
  showReport(nextReport, saved?.id);
}

function showBriefForm() {
  if (history.state?.giftReport) history.replaceState(null, "", location.href);
  form.hidden = false;
  surprise.hidden = false;
  loadedRun = undefined;
  select("resume-run").hidden = true;
  select("report-brief").hidden = true;
}

select("new-search").addEventListener("click", () => {
  showBriefForm();
  message();
  showSampleBrief(readBrief());
  select("recipient").focus();
});

function openInitialReport() {
  const linked = location.hash.startsWith(reportFragment);
  try {
    const embedded = select("initial-report")?.textContent;
    if (embedded) openReport(JSON.parse(embedded));
    else if (linked) {
      const nextReport = JSON.parse(decodeURIComponent(location.hash.slice(reportFragment.length)));
      openReport(nextReport);
      history.replaceState({ giftReport: nextReport }, "", location.pathname + location.search);
    } else if (history.state?.giftReport) openReport(history.state.giftReport);
  } catch {
    if (linked) history.replaceState(null, "", location.pathname + location.search);
    message("The dashboard could not load the gift report.");
  }
}

window.addEventListener("hashchange", () => {
  if (location.hash.startsWith(reportFragment)) openInitialReport();
});

function setRunning(value) {
  running = value;
  select("brief-fields").disabled = value;
  surprise.disabled = value;
  updateTeamActions();
  updateSearchButton();
  cards.setAttribute("aria-busy", String(value));
}

function updateTeamActions() {
  demoMode.disabled = running || loadingRun;
  for (const id of ["demo-scenario", "run-demo", "replay-run"]) select(id).disabled = running;
  select("replay-run").hidden = demoMode.checked || !lastRun?.events.length;
  select("stop-run").hidden = !runAbort;
  savedRuns.disabled = running || loadingRun || !savedRuns.options.length;
  select("load-run").disabled = savedRuns.disabled;
  select("resume-run").hidden = !loadedRun || !searchesLive();
  const canResume = searchesLive() && loadedRun && loadedRun.status !== "running" && harnessOptions.get(loadedRun.harness)?.available;
  select("continue-run").disabled = running || loadingRun || !canResume;
  select("additional-turns").disabled = running || loadingRun || !canResume;
  select("new-search").disabled = running || loadingRun;
  select("refine-search").disabled = running || loadingRun;
}

select("stop-run").addEventListener("click", () => runAbort?.abort());

function selectedHarness(id = harnessChoice.value) {
  return harnessOptions.get(id) ?? { id: "claude", label: "Claude Code" };
}

function updateChatVisibility() {
  select("chat-dock").hidden = !searchesLive() || !harnessOptions.get(harnessChoice.value)?.available;
}

function restoreTimeline(label, events, harness) {
  resetTeam(label, { expand: true, consoleLabel: `${harness.label} console` });
  for (const event of events) showTeamEvent(event);
}

async function readHistory(path) {
  const response = await fetch(path, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load saved runs.");
  return data;
}

async function refreshHistory(preferred = savedRuns.value) {
  if (!historyEnabled) return;
  const status = select("history-status");
  try {
    const runs = await readHistory(liveApi("runs"));
    const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
    savedRuns.replaceChildren(...runs.map((run) => new Option(
      [run.recipient, run.occasion, selectedHarness(run.harness).label, formatDate.format(new Date(run.updatedAt))].filter(Boolean).join(" · "),
      run.id,
    )));
    if (runs.some(({ id }) => id === preferred)) savedRuns.value = preferred;
    if (!loadedRun) status.textContent = runs.length ? "" : "No saved research runs yet.";
  } catch {
    status.textContent = "Could not load saved runs.";
  } finally {
    updateTeamActions();
  }
}

select("load-run").addEventListener("click", async () => {
  if (running || loadingRun || !savedRuns.value) return;
  loadingRun = true;
  updateTeamActions();
  try {
    const saved = await readHistory(liveApi(`runs/${encodeURIComponent(savedRuns.value)}`));
    openReport(saved.report, saved);
    loadedRun = saved;
    if (harnessOptions.get(saved.harness)?.available) harnessChoice.value = saved.harness;
    updateChatVisibility();
    const harness = selectedHarness(saved.harness);
    restoreTimeline(`Saved ${harness.label} run`, saved.events, harness);
    if (saved.status === "complete") finishTeam(saved.report.gifts.length);
    else if (saved.status !== "running") stopTeam();
    lastRun = { id: saved.id, events: saved.events, report: saved.report, harness, completed: saved.status === "complete" };
    const summary = `${saved.completedTurns} ${saved.completedTurns === 1 ? "turn" : "turns"} saved.`;
    select("history-status").textContent = saved.status === "running" ? "This run is still active."
      : `${summary}${saved.status === "complete" ? "" : " Continue from the last completed turn."}`;
    select("additional-turns").value = "1";
    message();
  } catch (error) {
    message(error.message);
  } finally {
    loadingRun = false;
    updateTeamActions();
  }
});

select("resume-run").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (running || loadingRun || !loadedRun || select("continue-run").disabled) return;
  const researchTurns = select("additional-turns").valueAsNumber;
  await startSearch({ runId: loadedRun.id, researchTurns }, loadedRun);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await liveAvailability;
  if (running || loadingRun) return;
  message();
  briefStatus.textContent = "";
  const brief = readBrief();
  if (!validBrief(brief) || !brief.recipient) {
    message("Enter a recipient and a valid budget.");
    return;
  }
  if (!searchesLive()) {
    if (demoMode.checked) showSampleBrief(brief);
    return;
  }
  const researchTurns = select("research-turns").valueAsNumber;
  await startSearch(harnessMode ? { ...brief, researchTurns, harness: selectedHarness().id } : brief);
});

async function startSearch(body, saved) {
  const harness = selectedHarness(saved?.harness ?? body.harness);
  let runId = saved?.id;
  const events = saved?.events.slice(0, saved.committedEvents) ?? [];
  message();
  if (harnessMode) runAbort = new AbortController();
  setRunning(true);
  if (harnessMode) restoreTimeline(`Live ${harness.label} run`, events, harness);
  try {
    const response = await fetch(liveApi("search"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(harnessMode && { Accept: "application/x-ndjson" }) },
      body: JSON.stringify(body),
      signal: runAbort?.signal,
    });
    if (harnessMode && response.ok) {
      let completed;
      await consumeEvents(response, (event) => {
        if (event.kind === "report") completed = validateReport(event.report);
        else if (event.kind === "run-started") runId = event.id;
        else {
          events.push(event);
          showTeamEvent(event);
        }
      });
      if (!completed) throw new Error("The agent team did not finish the shortlist.");
      if (body.refinement) {
        showReportBrief(completed.brief, body.refinement.focus);
        select("additional-turns").value = "1";
      }
      showReport(completed, runId);
      finishTeam(completed.gifts.length);
      if (events.length) lastRun = { id: runId, events, report: completed, harness, completed: true };
    } else {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Live search could not finish.");
      showReport(validateReport(result));
    }
  } catch (error) {
    if (harnessMode) stopTeam();
    if (!runAbort?.signal.aborted) message(error.message || "Live search could not finish.");
  } finally {
    const stopped = runAbort?.signal.aborted;
    runAbort = undefined;
    if ((saved || body.refinement) && runId && historyEnabled) {
      try {
        loadedRun = await readHistory(liveApi(`runs/${encodeURIComponent(runId)}`));
        if (stopped && loadedRun.status === "running") loadedRun.status = "stopped";
        if (loadedRun.status !== "running") select("history-status").textContent = `${loadedRun.completedTurns} turns saved.`;
      } catch {
        // The currently loaded checkpoint can still be retried.
      }
    }
    setRunning(false);
    void refreshHistory(runId);
  }
}

select("replay-run").addEventListener("click", async () => {
  if (running || !lastRun) return;
  message();
  setRunning(true);
  try {
    const { id, events, report, harness, completed } = lastRun;
    await replayTimeline(events, `Replay · ${harness.label}`, report.gifts.length, { consoleLabel: `${harness.label} console`, completed });
    showReport(report, id);
  } finally {
    setRunning(false);
  }
});

demoChoice.replaceChildren(...demoScenarios.map(({ id, title }) => new Option(title, id)));
demoMode.addEventListener("change", () => {
  message();
  briefStatus.textContent = "";
  updateMode();
  if (!demoMode.checked && report.mode === "sample" && !form.hidden) resetTeam(teamIntroduction);
  render();
});

demoChoice.addEventListener("change", () => {
  select("demo-link").hidden = true;
  select("demo-link-status").textContent = "";
});

const copyDemoLink = select("copy-demo-link");
copyDemoLink.hidden = location.protocol === "file:";
copyDemoLink.addEventListener("click", async () => {
  const url = new URL(location.href);
  if (gridMount) url.pathname = gridMount;
  url.search = "";
  url.hash = "";
  url.searchParams.set("demo", demoChoice.value);
  const status = select("demo-link-status");
  try {
    await navigator.clipboard.writeText(url.href);
    copyDemoLink.textContent = "Copied";
    status.textContent = "Demo link copied.";
    setTimeout(() => { copyDemoLink.textContent = "Copy link"; }, 1500);
  } catch {
    const field = select("demo-link");
    field.value = url.href;
    field.hidden = false;
    field.focus();
    field.select();
    status.textContent = "Demo link selected. Copy it with your keyboard or device menu.";
  }
});

select("run-demo").addEventListener("click", async () => {
  if (running || !demoMode.checked) return;
  const scenario = demoScenarios.find(({ id }) => id === demoChoice.value);
  if (!scenario) return;
  showBriefForm();
  priceComparison.checked = false;
  updateBudgetLimit();
  fillExampleBrief(scenario.brief);
  message();
  setRunning(true);
  try {
    const { events, report } = createDemoRun(scenario);
    await replayTimeline(events, `Demo · ${scenario.title}`, report.gifts.length, { demo: true });
    showReport(report);
  } finally {
    setRunning(false);
  }
});

function currentChatBrief() {
  return report.mode === "sample" && !form.hidden ? readBrief() : report.brief;
}

function chatContext() {
  return {
    research: {
      runId: displayedRunId,
      activeTurn: select("team-turn").hidden ? null : select("team-turn").textContent,
      inProgress: Boolean(runAbort),
      handoffs: recentResearchNotes(),
    },
    latestShortlist: {
      mode: report.mode,
      brief: currentChatBrief(),
      gifts: report.gifts.slice(0, 5).map(({ name, merchant, price, url, caveat }) => ({ name, merchant, price, url, caveat })),
      notes: report.notes.slice(0, 8).map((note) => note.slice(0, 500)),
    },
  };
}

function updateRefineCurrency() {
  const comparison = refineForm.elements.namedItem("comparePriceBands");
  const usd = refineForm.elements.namedItem("currency").value.trim().toUpperCase() === "USD";
  select("refine-comparison-control").hidden = !usd;
  comparison.disabled = !usd;
}

async function openRefinement(suggestion) {
  if (!searchesLive() || running || loadingRun || refineDialog.open) return;
  const runId = displayedRunId;
  const currentBrief = currentChatBrief();
  loadingRun = true;
  updateTeamActions();
  try {
    const saved = runId && historyEnabled ? await readHistory(liveApi(`runs/${encodeURIComponent(runId)}`)) : undefined;
    if (saved?.status === "running") throw new Error("Wait for this search to finish before refining it.");
    const brief = saved?.report.brief ?? currentBrief;
    const fields = refineForm.elements;
    for (const name of ["recipient", "occasion", "interests", "budget", "currency", "region", "neededBy", "exclude"]) {
      fields.namedItem(name).value = brief[name] ?? "";
    }
    const sameBrief = suggestion && suggestion.context.research.runId === runId
      && JSON.stringify(suggestion.context.latestShortlist.brief) === JSON.stringify(brief);
    fields.namedItem("focus").value = sameBrief ? suggestion.focus : "";
    fields.namedItem("comparePriceBands").checked = brief.comparePriceBands === true;
    updateRefineCurrency();
    refinementSource = saved;
    select("refine-status").textContent = "";
    refineDialog.showModal();
  } catch (error) {
    message(error.message || "Could not open the refinement brief.");
  } finally {
    loadingRun = false;
    updateTeamActions();
  }
}

select("refine-currency").addEventListener("input", updateRefineCurrency);
select("cancel-refinement").addEventListener("click", () => refineDialog.close());
refineForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (running || loadingRun || !searchesLive()) return;
  const { focus, ...fields } = Object.fromEntries(new FormData(refineForm));
  const brief = {
    ...fields, recipient: fields.recipient.trim(), occasion: fields.occasion.trim(), interests: fields.interests.trim(),
    budget: Number(fields.budget), currency: fields.currency.trim().toUpperCase(), region: fields.region.trim(),
    neededBy: fields.neededBy || null, exclude: fields.exclude.trim(),
    ...(fields.comparePriceBands && { comparePriceBands: true }),
  };
  if (!focus.trim() || !validBrief(brief) || !brief.recipient || !brief.occasion || !brief.region) {
    select("refine-status").textContent = "Enter a valid brief and research focus.";
    return;
  }
  const saved = refinementSource;
  const refinement = { brief, focus: focus.trim(), ...(saved && { expectedUpdatedAt: saved.updatedAt }) };
  refineDialog.close();
  await startSearch({ refinement, researchTurns: 1, ...(saved && { runId: saved.id }) }, saved);
});

function updateInterestSuggestions() {
  const chosen = interestsInput.value.trim().toLowerCase();
  for (const button of interestSuggestions) {
    button.setAttribute("aria-pressed", String(button.dataset.interest.toLowerCase() === chosen));
  }
}

function updateBriefPreview() {
  updateInterestSuggestions();
  message();
  briefStatus.textContent = "";
  if (!demoMode.checked) return;
  const brief = readBrief();
  if (validBrief(brief) && brief.recipient) showSampleBrief(brief);
}

function fillExampleBrief({ recipient, occasion, interests, budget }) {
  recipientChoice.value = [...recipientChoice.options].some((option) => option.value === recipient) ? recipient : "";
  if (!recipientChoice.value) customRecipient.value = recipient;
  updateRecipient();
  select("occasion").value = occasion;
  interestsInput.value = interests;
  if (priceComparison.checked) budgetBeforeComparison = String(budget);
  else budgetInput.value = budget;
  updateBriefPreview();
}

surprise.addEventListener("click", () => {
  const choices = exampleBriefs.filter((brief) => brief.interests !== interestsInput.value);
  fillExampleBrief(choices[Math.floor(Math.random() * choices.length)]);
});

for (const button of interestSuggestions) {
  button.addEventListener("click", () => {
    interestsInput.value = button.dataset.interest;
    updateBriefPreview();
  });
}

sort.addEventListener("change", render);
recipientChoice.addEventListener("change", updateRecipient);
interestsInput.addEventListener("input", updateInterestSuggestions);
region.addEventListener("change", updateBudgetCurrency);
priceComparison.addEventListener("change", () => {
  updateBudgetLimit();
  updateBriefPreview();
});

function downloadFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = element("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

select("download").addEventListener("click", () => downloadFile(JSON.stringify(report, null, 2) + "\n", "gift-report.json", "application/json"));
select("download-memory").addEventListener("click", () => downloadFile(researchMemory(), "memory.md", "text/markdown;charset=utf-8"));
enableShareResults(() => ({ report, gifts: sortedGifts() }), downloadFile);

async function checkLiveAvailability() {
  // A static site can omit this endpoint. An HTML fallback also leaves the demo available.
  if (!gridMount && !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;
  try {
    const response = await fetch(liveApi("config"));
    if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) return;
    const config = await response.json();
    liveReady = config.live === true;
    wipeEnabled = Boolean(gridMount) && liveReady && config.sessionWipe === true;
    if (config.claude === true) {
      harnessMode = true;
      const available = config.harnesses ?? [{ id: "claude", label: "Claude Code", available: true }];
      for (const option of available) harnessOptions.set(option.id, option);
      harnessChoice.replaceChildren(...available.map(({ id, label, available }) => {
        const option = new Option(available ? label : `${label} (unavailable)`, id);
        option.disabled = !available;
        return option;
      }));
      const preferred = harnessOptions.get(config.defaultHarness ?? "claude");
      harnessChoice.value = preferred?.available ? preferred.id : available.find((option) => option.available)?.id ?? "";
      liveReady &&= Boolean(harnessChoice.value);
      select("research-turns").max = config.maxResearchTurns ?? 5;
      select("additional-turns").max = config.maxResearchTurns ?? 5;
      harnessChoice.addEventListener("change", updateChatVisibility);
      if (harnessChoice.value) enableChat({
        endpoint: liveApi("chat"), getContext: chatContext, getHarness: selectedHarness, onActivity: showTeamEvent,
        onInspectLink: inspectLink,
        onRefine: config.refinements === true ? openRefinement : undefined,
      });
      historyEnabled = config.history === true;
      retailerThumbnails = config.retailerThumbnails === true;
      if (gridMount && historyEnabled) select("search-history").open = true;
      void refreshHistory();
    }
  } catch {
    // A separate server is optional for the sample and import workflows.
  }
}

updateRecipient();
updateInterestSuggestions();
render();
openInitialReport();
if (gridMount) {
  form.autocomplete = "off";
  select("claude-chat").autocomplete = "off";
  try {
    if (sessionStorage.getItem(wipedSessionKey)) {
      sessionStorage.removeItem(wipedSessionKey);
      briefStatus.textContent = "Session wiped.";
    }
  } catch {
    // Browser storage is optional.
  }
}
const linkedDemo = demoScenarios.find(({ id }) => id === new URLSearchParams(location.search).get("demo"));
if (linkedDemo && !form.hidden) {
  demoMode.checked = true;
  demoChoice.value = linkedDemo.id;
  fillExampleBrief(linkedDemo.brief);
}
const liveAvailability = checkLiveAvailability().finally(updateMode);
