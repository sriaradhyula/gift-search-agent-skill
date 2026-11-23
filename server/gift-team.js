import { productUrl } from "../skills/gift-search/scripts/report.mjs";
import { listingKey, verifiedGifts } from "./search.js";

export const MAX_RESEARCH_TURNS = 5;

const defaultReviewer = {
  name: "Retailer reviewer", persona: "Retail listing specialist",
  focus: "Check each listing’s variant, price, stock, and destination.",
};
const defaultScouts = [
  ["Interest scout", "Interest-led gift researcher", "Find gifts tied to the recipient’s interests."],
  ["Occasion scout", "Occasion and fit researcher", "Find complementary gifts that suit the recipient and occasion."],
  ["Value scout", "Value-for-money researcher", "Find less expensive alternatives to leads that strained the budget."],
  ["Delivery scout", "Shipping options researcher", "Find alternatives with clearer delivery coverage or timing."],
  ["Practicality scout", "Everyday gift specialist", "Find durable gifts that would see regular use."],
  ["Discovery scout", "Specialty retailer researcher", "Look at stores and categories the previous scouts did not cover."],
  ["Compact gift scout", "Small-space gift specialist", "Look for gifts that need little storage or setup."],
  ["Recipient fit scout", "Recipient preferences researcher", "Use the brief and review feedback to find ideas with a stronger fit."],
  ["Quality scout", "Materials and quality researcher", "Look for well-made options with clear specifications."],
  ["Variety scout", "Alternative gift researcher", "Explore an eligible gift category the shortlist does not already cover."],
  ["Keepsake scout", "Personal gift researcher", "Look for meaningful gifts that suit the occasion and delivery deadline."],
  ["Accessory scout", "Complementary gift specialist", "Find useful accessories tied to the recipient’s interests."],
  ["Flexible fit scout", "Sizing and compatibility researcher", "Find gifts with fewer size or compatibility uncertainties."],
  ["Small-brand scout", "Independent shop researcher", "Look for eligible gifts from independent makers with direct listings."],
  ["Starter gift scout", "Beginner-friendly gift researcher", "Find self-contained gifts that are easy to use."],
];

const clean = (value, length) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, length) : "";
const roleKey = (value) => value.toLowerCase();

function normalizeTeam(plan, turn, previousScouts, existingReviewer) {
  if (!Array.isArray(plan?.scouts) || plan.scouts.length < 2 || plan.scouts.length > 3) {
    throw new Error("The planner did not assign two or three research agents.");
  }
  const normalizeRole = (role, id) => ({
    id,
    name: clean(role?.name, 45),
    persona: clean(role?.persona, 110),
    focus: clean(role?.focus, 220),
  });
  const scouts = plan.scouts.map((role, index) => normalizeRole(role, `scout-${turn}-${index + 1}`));
  const reviewer = existingReviewer ?? normalizeRole(plan.reviewer, "review");
  const roles = [...previousScouts, ...scouts, reviewer];
  if (roles.some(({ name, persona, focus }) => !name || !persona || !focus)
      || new Set(roles.map(({ name }) => roleKey(name))).size !== roles.length
      || new Set(roles.map(({ persona }) => roleKey(persona))).size !== roles.length) {
    throw new Error("The planner did not assign distinct roles.");
  }
  return { scouts, reviewer };
}

function defaultPlan(previousScouts, reviewer = defaultReviewer, turn) {
  const roles = [...previousScouts, reviewer];
  const personas = new Set(roles.map(({ persona }) => roleKey(persona)));
  const names = new Set(roles.map(({ name }) => roleKey(name)));
  const unused = defaultScouts.filter(([, persona]) => !personas.has(roleKey(persona))).slice(0, 2);
  for (let slot = unused.length; slot < 2; slot++) {
    const [name, specialty, focus] = defaultScouts[(turn * 2 + slot) % defaultScouts.length];
    let persona = `${specialty} following up in turn ${turn}`;
    while (personas.has(roleKey(persona))) persona += " again";
    personas.add(roleKey(persona));
    unused.push([name, persona, `${focus} Focus on questions left open by the last review.`]);
  }
  const scouts = unused
    .map(([baseName, persona, focus]) => {
      let name = baseName;
      for (let suffix = 2; names.has(roleKey(name)); suffix++) name = `${baseName} ${suffix}`;
      names.add(roleKey(name));
      return { name, persona, focus };
    });
  return { scouts, reviewer };
}

function proposals(result, seeds) {
  if (!Array.isArray(result.candidates)) throw new Error("The scout did not return a candidate list.");
  return result.candidates.flatMap((proposal) => {
    const reason = clean(proposal?.reason, 400);
    if (!reason) return [];
    const seed = Number.isInteger(proposal.seedId) ? seeds[proposal.seedId] : null;
    if (proposal.seedId != null && !seed) return [];
    const name = clean(seed?.name ?? proposal.name, 280);
    const url = productUrl(proposal.url);
    if (!name || (!seed && !url)) return [];
    return [{
      name,
      merchant: seed?.merchant ?? (clean(proposal.merchant, 100) || null),
      fromShopping: Boolean(seed),
      ...(seed?.listedPrice && { listedPrice: seed.listedPrice }),
      ...(seed?.imageUrl && { imageUrl: seed.imageUrl }),
      ...(url && { url: url.href }),
      reason,
    }];
  }).slice(0, 2);
}

export async function runGiftTeam(brief, {
  researchTurns: nextTurns = 1, seeds = [], plan, scout, review, signal, resume,
  onEvent = () => {}, onCheckpoint = async () => {},
}) {
  if (!Number.isInteger(nextTurns) || nextTurns < 1 || nextTurns > MAX_RESEARCH_TURNS) {
    throw new Error(`Choose between 1 and ${MAX_RESEARCH_TURNS} research turns.`);
  }
  const saved = resume ? structuredClone(resume) : {};
  const { board = [], handoff = [], notes = [], previousScouts = [], completedTurns = 0 } = saved;
  const verified = new Map(saved.verified);
  const reviewReasons = new Map(saved.reviewReasons);
  const pending = new Set(saved.pending);
  let reviewer = saved.reviewer;
  const researchTurns = completedTurns + nextTurns;

  function results() {
    const leads = handoff.flatMap(({ candidateId, scouts, ...lead }) => {
      if (verified.has(candidateId)) return [];
      return [{
        ...lead, url: lead.url ?? null,
        review: reviewReasons.get(candidateId) ?? "The reviewer could not check this lead.",
      }];
    });
    return { gifts: verifiedGifts(brief, handoff, [...verified.values()]), leads, notes };
  }

  function post(turn, author, text, type, url) {
    const role = typeof author === "string" ? null : author;
    const message = {
      id: board.length + 1, turn, author: role?.name ?? author, text, type,
      ...(role && { roleId: role.id }), ...(url && { url }),
    };
    board.push(message);
    onEvent({ kind: "board-post", message });
  }

  function highlightWriter(turn, role) {
    const posted = new Set();
    return (value) => {
      const text = clean(value, 450);
      if (signal?.aborted || !text || posted.size >= 3 || posted.has(text)) return;
      posted.add(text);
      post(turn, role, text, "highlight");
    };
  }

  const discovery = Promise.resolve(seeds);
  let successfulScouts = 0;
  let firstError;
  for (let turn = completedTurns + 1; turn <= researchTurns; turn++) {
    signal?.throwIfAborted();
    onEvent({ kind: "planning-start", turn, researchTurns });
    let team;
    let planned = true;
    try {
      const assignment = await plan(brief, researchTurns, {
        turn, board: board.slice(), previousScouts: previousScouts.slice(), reviewer,
      });
      team = normalizeTeam(assignment, turn, previousScouts, reviewer);
    } catch {
      signal?.throwIfAborted();
      team = normalizeTeam(defaultPlan(previousScouts, reviewer, turn), turn, previousScouts, reviewer);
      planned = false;
      notes.push(`Turn ${turn} used preset scouts because a distinct team plan was unavailable.`);
    }
    signal?.throwIfAborted();
    reviewer ??= team.reviewer;
    previousScouts.push(...team.scouts);
    onEvent({ kind: "team-plan", ...team, turn, researchTurns, planned });
    if (!planned) post(turn, "Coordinator", "Assigned preset scouts for this turn.", "plan");
    for (const role of turn === 1 ? [...team.scouts, reviewer] : team.scouts) {
      post(turn, role, `${role.persona} · ${role.focus}`, "assignment");
    }

    const seedList = await discovery;
    signal?.throwIfAborted();
    onEvent({ kind: "turn-start", turn, researchTurns });
    post(turn, "Coordinator", turn === 1 ? "Research started." : "Agents are using the previous turn’s findings and review decisions.", "turn");

    // Each scout starts with the same board snapshot. Posts arriving in this turn go to the reviewer.
    const shared = board.slice();
    const updates = await Promise.allSettled(team.scouts.map(async (role) => {
      onEvent({ kind: "scout-start", role: role.name, roleId: role.id, turn });
      try {
        const writeHighlight = highlightWriter(turn, role);
        const response = await scout(role, brief, seedList, shared, turn, writeHighlight);
        const highlights = Array.isArray(response.highlights) ? response.highlights.slice(0, 3) : [];
        for (const text of highlights) writeHighlight(text);
        const message = clean(response.message, 450);
        if (message) writeHighlight(message);
        const candidates = proposals(response, seedList);
        onEvent({ kind: "scout-handoff", role: role.name, roleId: role.id, turn, candidates });
        for (const candidate of candidates) {
          post(turn, role, `${candidate.name} · ${candidate.reason}`, "lead", candidate.url);
        }
        if (!candidates.length) post(turn, role, "No new leads this turn.", "update");
        return candidates;
      } catch (error) {
        onEvent({ kind: "scout-failure", role: role.name, roleId: role.id, turn });
        post(turn, role, "Unavailable this turn.", "error");
        throw error;
      }
    }));
    signal?.throwIfAborted();

    for (const [index, update] of updates.entries()) {
      const role = team.scouts[index];
      if (update.status === "rejected") {
        firstError ??= update.reason;
        notes.push(`${role.name} was unavailable in turn ${turn}.`);
        continue;
      }
      successfulScouts++;
      for (const { reason, ...candidate } of update.value) {
        const url = listingKey(candidate.url);
        const name = candidate.name.toLowerCase();
        const match = handoff.find((item) => {
          const priorUrl = listingKey(item.url);
          return (url && priorUrl === url) || ((!url || !priorUrl) && item.name.toLowerCase() === name);
        });
        const contribution = { role: role.name, roleId: role.id, reason };
        if (match) {
          if (!match.scouts.some((entry) => entry.roleId === role.id)) match.scouts.push(contribution);
          if (candidate.fromShopping && !match.fromShopping) {
            match.fromShopping = true;
            match.listedPrice = candidate.listedPrice;
            match.imageUrl = candidate.imageUrl;
          }
          if (!match.url && candidate.url && !verified.has(match.candidateId)) {
            match.url = candidate.url;
            match.merchant = candidate.merchant ?? match.merchant;
            pending.add(match.candidateId);
          }
        } else {
          const candidateId = handoff.length;
          handoff.push({ ...candidate, candidateId, scouts: [contribution] });
          pending.add(candidateId);
        }
      }
    }

    const candidates = [...pending].map((id) => handoff[id]);
    if (candidates.length) {
      onEvent({ kind: "review-start", role: reviewer.name, roleId: reviewer.id, turn, candidates });
      const allowed = new Set(candidates.map(({ candidateId }) => candidateId));
      try {
        const outcome = await review(reviewer, brief, candidates, board.slice(), turn, highlightWriter(turn, reviewer));
        for (const listing of outcome.gifts) {
          if (allowed.has(listing?.candidateId) && outcome.fetched.has(listingKey(listing.url))
              && verifiedGifts(brief, handoff, [listing]).length && !verified.has(listing.candidateId)) {
            verified.set(listing.candidateId, listing);
          }
        }

        const decisions = candidates.map((candidate) => {
          const listing = verified.get(candidate.candidateId);
          const rejection = outcome.rejected.find((gift) => gift?.candidateId === candidate.candidateId);
          const accepted = Boolean(listing);
          const reason = accepted ? listing.reason : clean(rejection?.reason, 800) || "The review did not establish a qualifying retailer offer.";
          if (!accepted) reviewReasons.set(candidate.candidateId, reason);
          const message = `${accepted ? "Verified" : "Passed over"} ${candidate.name} · ${reason}`;
          post(turn, reviewer, message, accepted ? "verified" : "decision", listing?.url ?? candidate.url);
          notes.push(message);
          pending.delete(candidate.candidateId);
          return { name: candidate.name, accepted, reason };
        });
        for (const note of outcome.notes.slice(0, 4)) {
          const text = clean(note, 450);
          if (text) {
            post(turn, reviewer, text, "update");
            notes.push(text);
          }
        }
        onEvent({ kind: "review-complete", role: reviewer.name, roleId: reviewer.id, turn, decisions });
      } catch {
        signal?.throwIfAborted();
        post(turn, reviewer, "Review unavailable. Unchecked leads stay on the board.", "error");
        notes.push(`Review was unavailable in turn ${turn}.`);
        onEvent({ kind: "review-skipped", role: reviewer.name, turn, status: "Unavailable" });
      }
    } else {
      onEvent({ kind: "review-skipped", role: reviewer.name, turn, status: "No new leads" });
      post(turn, reviewer, "No new leads to check.", "update");
    }
    signal?.throwIfAborted();
    onEvent({ kind: "turn-complete", turn, researchTurns });
    if (successfulScouts) {
      await onCheckpoint({
        completedTurns: turn, board, handoff, notes, previousScouts, reviewer,
        verified: [...verified.entries()], reviewReasons: [...reviewReasons.entries()], pending: [...pending],
      }, results());
    }
  }

  if (!successfulScouts && firstError) throw firstError;
  return results();
}
