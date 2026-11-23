import { examples, runSample, sampleImage } from "./sample.js";
import { createDemoRun, demoScenarios } from "./demos.js";
import { formatMoney, productUrl, shoppingThumbnail, validBrief, validateReport } from "./report.js";
import { consumeEvents, finishTeam, recentResearchNotes, replayTimeline, researchMemory, resetTeam, showTeamEvent, stopTeam } from "./team.js";
import { enableChat } from "./chat.js";
import { enableShareResults } from "./share.js";

const select = (id) => document.getElementById(id);
const form = select("gift-form");
const recipientChoice = select("recipient");
const customRecipient = select("custom-recipient");
const interestsInput = select("interests");
const interestSuggestions = document.querySelectorAll("[data-interest]");
const surprise = select("surprise-brief");
const briefStatus = select("brief-status");
const cards = select("cards");
const sort = select("sort");
const live = select("live-search");
const harnessChoice = select("run-harness");
const savedRuns = select("saved-runs");
const region = select("region");
const file = select("import-file");
const dialog = select("gift-detail");
const demoChoice = select("demo-scenario");
const gridMount = document.querySelector('meta[name="gift-search-mount"]')?.content;
const liveApi = (path) => `${gridMount ?? "."}/api/${path}`;
const reportFragment = "#report=";
const teamIntroduction = "Follow the team from first ideas to shortlist.";
const regionCurrencies = { US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", DE: "EUR", FR: "EUR", IN: "INR", JP: "JPY" };
const modeLabels = { sample: "Sample run", live: "Live search", ideas: "Ideas only" };
const modeDescriptions = {
  sample: "Illustrative gifts and prices from the demo catalog.",
  live: "Listings from a web search. Check the retailer for changes.",
  ideas: "Suggested gifts without a verified listing.",
};
const exampleBriefs = Object.values(examples);

let report = runSample(readBrief());
let running = false;
let harnessMode = false;
let historyEnabled = false;
let loadingRun = false;
let loadedRun;
const harnessOptions = new Map();
let runAbort;
let lastRun;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function price(gift) {
  return gift.price === null ? "Price unknown" : formatMoney(gift.price, report.brief.currency);
}

function openGift(gift) {
  select("detail-category").textContent = gift.category;
  select("detail-title").textContent = gift.name;
  select("detail-price").textContent = [price(gift), gift.merchant].filter(Boolean).join(" · ");
  select("detail-reason").textContent = gift.reason;
  const caveat = select("detail-caveat");
  caveat.textContent = gift.caveat;
  caveat.hidden = !gift.caveat;
  const link = select("detail-link");
  const url = productUrl(gift.url);
  link.hidden = !url;
  if (url) link.href = url.href;
  else link.removeAttribute("href");
  dialog.showModal();
}

function appendThumbnail(card, imageUrl) {
  const thumbnail = shoppingThumbnail(imageUrl);
  if (thumbnail) {
    const photo = element("img", "card-thumbnail");
    photo.alt = "";
    photo.loading = "lazy";
    photo.referrerPolicy = "no-referrer";
    photo.addEventListener("error", () => photo.remove(), { once: true });
    photo.src = thumbnail.href;
    card.append(photo);
  }
}

function buildCard(gift) {
  const card = element("article", "gift-card");
  const image = report.mode === "sample" ? sampleImage(gift.name) : -1;
  if (image >= 0) {
    const photo = element("div", `card-photo photo-${image}`);
    photo.setAttribute("aria-hidden", "true");
    card.append(photo);
  }
  if (report.mode === "live") appendThumbnail(card, gift.imageUrl);

  const body = element("div", "card-body");
  const title = element("h3", "", gift.name);
  const category = element("p", "card-category", [gift.category, gift.merchant].filter(Boolean).join(" · "));
  const reason = element("p", "card-reason", gift.reason);
  const footer = element("div", "card-footer");
  const cost = element("span", "card-price", price(gift));
  const details = element("button", "text-link", "Details →");
  details.type = "button";
  details.setAttribute("aria-label", `Details for ${gift.name}`);
  details.addEventListener("click", () => openGift(gift));
  footer.append(cost, details);
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
    const link = element("a", "text-link", "Open scout link ↗");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    footer.append(link);
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

function render() {
  const { mode, brief, gifts, notes, checkedOn, discovery, leads = [] } = report;
  select("mode-label").textContent = modeLabels[mode];
  select("mode-description").textContent = checkedOn
    ? `Listings checked ${checkedOn}. Check the retailer for changes.` : modeDescriptions[mode];
  const budget = brief.budget === null ? "" : ` · Up to ${formatMoney(brief.budget, brief.currency)} ${brief.currency}`;
  const details = [brief.recipient, brief.occasion].filter(Boolean).join(" · ");
  const resultType = mode === "live" ? (gifts.length === 1 ? "verified gift" : "verified gifts")
    : (gifts.length === 1 ? "idea" : "ideas");
  select("summary").textContent = [`${gifts.length} ${resultType}`, details].filter(Boolean).join(" · ") + budget;
  const discoveryStatus = select("discovery-status");
  discoveryStatus.hidden = !discovery;
  discoveryStatus.textContent = discovery ?? "";
  cards.replaceChildren(...sortedGifts().map(buildCard));
  select("share-results").disabled = !gifts.length && !leads.length;
  select("research-leads").hidden = !leads.length;
  select("leads-summary").textContent = `${leads.length} research ${leads.length === 1 ? "lead" : "leads"}`;
  select("lead-cards").replaceChildren(...leads.map(buildLeadCard));
  select("empty").hidden = gifts.length > 0 || leads.length > 0;
  select("empty-title").textContent = mode === "live" ? "No verified gifts" : "No matching gifts";
  select("empty-message").textContent = mode === "sample"
    ? "Try a different interest, budget, or example brief."
    : "Check the run notes for details, or broaden the brief and search again.";
  sort.disabled = gifts.length < 2;
  const notesList = select("run-notes");
  notesList.replaceChildren(...notes.map((note) => element("li", "", note)));
  notesList.hidden = !notes.length || (mode === "sample" && notes.length === 1 && notes[0] === examplesNote);
}

const examplesNote = report.notes[0];

function message(text = "") {
  const banner = select("message");
  banner.hidden = !text;
  banner.textContent = text;
}

function updateRegion() {
  if (!live.checked) region.value = "US";
  region.disabled = !live.checked;
  select("budget-currency").textContent = regionCurrencies[region.value];
  const showResearchTurns = harnessMode && live.checked;
  select("harness-setting").hidden = !showResearchTurns;
  select("research-setting").hidden = !showResearchTurns;
  select("research-turns").disabled = !showResearchTurns;
}

function updateRecipient() {
  const custom = recipientChoice.value === "";
  select("custom-recipient-field").hidden = !custom;
  customRecipient.disabled = !custom;
}

function readBrief() {
  return {
    recipient: recipientChoice.value || customRecipient.value.trim(),
    occasion: select("occasion").value,
    interests: interestsInput.value.trim(),
    budget: select("budget").valueAsNumber,
    currency: regionCurrencies[region.value],
    region: region.selectedOptions[0].text,
    neededBy: select("neededBy").value || null,
    exclude: select("exclude").value.trim(),
  };
}

function showReport(nextReport) {
  report = nextReport;
  sort.value = "recommended";
  render();
}

function showSampleBrief(brief) {
  resetTeam(teamIntroduction);
  showReport(runSample(brief));
}

function openReport(nextReport) {
  const { brief } = validateReport(nextReport);
  resetTeam(teamIntroduction);
  const fields = [
    ["Recipient", brief.recipient],
    ["Occasion", brief.occasion],
    ["Interests", brief.interests],
    ["Max budget", brief.budget === null ? "" : `${formatMoney(brief.budget, brief.currency)} ${brief.currency}`],
    ["Ship to", brief.region],
    ["Needed by", brief.neededBy],
    ["Exclusions", brief.exclude],
  ];
  const list = select("report-brief-fields");
  list.replaceChildren(...fields.filter(([, value]) => value).map(([label, value]) => {
    const row = element("div");
    row.append(element("dt", "", label), element("dd", "", value));
    return row;
  }));
  form.hidden = true;
  surprise.hidden = true;
  loadedRun = undefined;
  select("resume-run").hidden = true;
  briefStatus.textContent = "";
  select("report-brief").hidden = false;
  showReport(nextReport);
}

select("new-search").addEventListener("click", () => {
  if (history.state?.giftReport) history.replaceState(null, "", location.href);
  form.hidden = false;
  surprise.hidden = false;
  loadedRun = undefined;
  select("resume-run").hidden = true;
  select("report-brief").hidden = true;
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
  select("import-button").disabled = value;
  updateTeamActions();
  select("search-label").textContent = value ? "Finding and checking gifts…" : "Find gifts";
  cards.setAttribute("aria-busy", String(value));
}

function updateTeamActions() {
  for (const id of ["demo-scenario", "run-demo", "replay-run"]) select(id).disabled = running;
  select("replay-run").hidden = !lastRun?.events.length;
  select("stop-run").hidden = !runAbort;
  savedRuns.disabled = running || loadingRun || !savedRuns.options.length;
  select("load-run").disabled = savedRuns.disabled;
  const canResume = loadedRun && loadedRun.status !== "running" && harnessOptions.get(loadedRun.harness)?.available;
  select("continue-run").disabled = running || loadingRun || !canResume;
  select("additional-turns").disabled = running || loadingRun || !canResume;
  select("new-search").disabled = running || loadingRun;
}

select("stop-run").addEventListener("click", () => runAbort?.abort());

function selectedHarness(id = harnessChoice.value) {
  return harnessOptions.get(id) ?? { id: "claude", label: "Claude Code" };
}

function updateChatHeading() {
  select("chat-title").textContent = `Chat with ${selectedHarness().label}`;
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
    openReport(saved.report);
    loadedRun = saved;
    harnessChoice.value = saved.harness;
    updateChatHeading();
    const harness = selectedHarness(saved.harness);
    restoreTimeline(`Saved ${harness.label} run`, saved.events, harness);
    if (saved.status === "complete") finishTeam(saved.report.gifts.length);
    else if (saved.status !== "running") stopTeam();
    lastRun = { events: saved.events, report: saved.report, harness, completed: saved.status === "complete" };
    const summary = `${saved.completedTurns} ${saved.completedTurns === 1 ? "turn" : "turns"} saved.`;
    select("history-status").textContent = saved.status === "running" ? "This run is still active."
      : `${summary}${saved.status === "complete" ? "" : " Continue from the last completed turn."}`;
    select("additional-turns").value = "1";
    select("resume-run").hidden = false;
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
  if (!live.checked) {
    showSampleBrief(brief);
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
      showReport(completed);
      finishTeam(completed.gifts.length);
      if (events.length) lastRun = { events, report: completed, harness, completed: true };
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
    if (saved && runId && historyEnabled) {
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
    const { events, report, harness, completed } = lastRun;
    await replayTimeline(events, `Replay · ${harness.label}`, report.gifts.length, { consoleLabel: `${harness.label} console`, completed });
    showReport(report);
  } finally {
    setRunning(false);
  }
});

demoChoice.replaceChildren(...demoScenarios.map(({ id, title }) => new Option(title, id)));
function revealDemoControls() {
  const controls = select("demo-controls");
  controls.hidden = false;
  select("try-demo").setAttribute("aria-expanded", "true");
  return controls;
}

select("try-demo").addEventListener("click", () => {
  const controls = revealDemoControls();
  (demoChoice.disabled ? controls : demoChoice).focus();
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
    setTimeout(() => { copyDemoLink.textContent = "Copy demo link"; }, 1500);
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
  if (running) return;
  const scenario = demoScenarios.find(({ id }) => id === demoChoice.value);
  if (!scenario) return;
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

function chatContext() {
  return {
    research: {
      activeTurn: select("team-turn").hidden ? null : select("team-turn").textContent,
      inProgress: Boolean(runAbort),
      handoffs: recentResearchNotes(),
    },
    latestShortlist: {
      mode: report.mode,
      brief: report.brief,
      gifts: report.gifts.slice(0, 5).map(({ name, merchant, price, url, caveat }) => ({ name, merchant, price, url, caveat })),
      notes: report.notes.slice(0, 8).map((note) => note.slice(0, 500)),
    },
  };
}

function updateInterestSuggestions() {
  const chosen = interestsInput.value.trim().toLowerCase();
  for (const button of interestSuggestions) {
    button.setAttribute("aria-pressed", String(button.dataset.interest.toLowerCase() === chosen));
  }
}

function updateBriefPreview() {
  updateInterestSuggestions();
  message();
  briefStatus.textContent = live.checked ? "Brief ready. Select Find gifts to search." : "";
  if (live.checked) return;
  const brief = readBrief();
  if (validBrief(brief) && brief.recipient) showSampleBrief(brief);
}

function fillExampleBrief({ recipient, interests, budget }) {
  recipientChoice.value = [...recipientChoice.options].some((option) => option.value === recipient) ? recipient : "";
  if (!recipientChoice.value) customRecipient.value = recipient;
  updateRecipient();
  select("occasion").value = "Christmas";
  interestsInput.value = interests;
  select("budget").value = budget;
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
live.addEventListener("change", () => {
  briefStatus.textContent = "";
  updateRegion();
});
region.addEventListener("change", updateRegion);
select("import-button").addEventListener("click", () => file.click());
file.addEventListener("change", async () => {
  const selected = file.files[0];
  if (!selected) return;
  try {
    if (selected.size > 1024 * 1024) throw new Error("Choose a report smaller than 1 MB.");
    let imported;
    try {
      imported = JSON.parse(await selected.text());
    } catch {
      throw new Error("The selected file could not be read as JSON.");
    }
    openReport(imported);
    message();
  } catch (error) {
    message(error.message);
  } finally {
    file.value = "";
  }
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
    select("live-setting").hidden = config.live !== true;
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
      live.checked = Boolean(harnessChoice.value);
      live.disabled = !harnessChoice.value;
      select("research-turns").max = config.maxResearchTurns ?? 5;
      select("additional-turns").max = config.maxResearchTurns ?? 5;
      updateRegion();
      select("live-label").textContent = "Search live retailers";
      harnessChoice.addEventListener("change", updateChatHeading);
      updateChatHeading();
      if (harnessChoice.value) enableChat({
        endpoint: liveApi("chat"), getContext: chatContext, getHarness: selectedHarness, onActivity: showTeamEvent,
      });
      historyEnabled = config.history === true;
      select("search-history").hidden = !historyEnabled;
      void refreshHistory();
    }
    else if (config.shopping === true) select("live-label").textContent = "Search Google Shopping";
  } catch {
    // A separate server is optional for the sample and import workflows.
  }
}

updateRecipient();
updateRegion();
updateInterestSuggestions();
render();
openInitialReport();
const linkedDemo = demoScenarios.find(({ id }) => id === new URLSearchParams(location.search).get("demo"));
if (linkedDemo && !form.hidden) {
  demoChoice.value = linkedDemo.id;
  fillExampleBrief(linkedDemo.brief);
  revealDemoControls();
}
const liveAvailability = checkLiveAvailability();
