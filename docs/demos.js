import { examples, runSample } from "./sample.js";

export const demoScenarios = [
  {
    title: "Coffee under $75",
    brief: examples.coffee,
    turns: [
      {
        scouts: [
          { name: "Brewing Scout", persona: "Home coffee specialist", focus: "Look for tools for slow mornings." },
          { name: "Tasting Scout", persona: "Specialty coffee sampler", focus: "Look for a gift that will be used up." },
        ],
        findings: [
          { names: ["Pour-over coffee set", "Burr grinder"], note: "Found a $48 pour-over set and a $72 burr grinder." },
          { names: ["Specialty coffee tasting flight"], note: "The $29 tasting flight gives them a few roasts to try." },
        ],
        review: "The pour-over set and tasting flight each fit the budget. The grinder reaches $84 with shipping. Find a practical replacement.",
      },
      {
        scouts: [
          { name: "Value Scout", persona: "Budget alternatives researcher", focus: "Replace the over-budget grinder with a more affordable option." },
          { name: "Pairing Scout", persona: "Gift assortment specialist", focus: "Check whether a new pick fills a gap in the shortlist." },
        ],
        findings: [
          { names: ["Insulated travel mug"], note: "Following the reviewer’s budget feedback, I’m replacing the grinder with a $34 travel mug." },
          { names: [], note: "The tasting flight already covers a consumable gift. I’ll leave it on the shortlist." },
        ],
        review: "The travel mug fits the budget too. Keep the set, mug, and tasting flight as three individual gift options.",
      },
    ],
  },
  {
    title: "Outdoor gifts under $70",
    brief: examples.outdoors,
    turns: [
      {
        scouts: [
          { name: "Trail Scout", persona: "Day-hike gear specialist", focus: "Find gifts useful on a short hike." },
          { name: "Picnic Scout", persona: "Outdoor dining specialist", focus: "Look for an easy way to carry food." },
          { name: "Packing Scout", persona: "Compact gear researcher", focus: "Check how much space each option takes." },
        ],
        findings: [
          { names: ["Insulated travel mug"], note: "The $34 travel mug works for a morning on the trail." },
          { names: ["Hard-sided cooler"], note: "Found a $68 cooler with room for a picnic lunch." },
          { names: ["Hard-sided cooler"], note: "This cooler is bulky for someone carrying lunch on foot." },
        ],
        review: "Keep the mug. The cooler is bulky, and its $12 shipping puts it over budget. Look for a lighter option.",
      },
      {
        scouts: [
          { name: "Hands-free Scout", persona: "Wearable gear specialist", focus: "Find an alternative to the cooler that leaves both hands free." },
          { name: "Capacity Scout", persona: "Bag capacity researcher", focus: "Check whether the lighter options fit lunch and drinks." },
          { name: "Comfort Scout", persona: "Carrying comfort specialist", focus: "Compare how the alternatives carry on a walk." },
        ],
        findings: [
          { names: ["Insulated picnic backpack"], note: "I found a $64 picnic backpack that leaves both hands free." },
          { names: ["Insulated picnic backpack"], note: "The same backpack has room for lunch and two drinks." },
          { names: [], note: "The backpack solves the packing problem flagged in the first turn." },
        ],
        review: "The scouts agreed on the backpack. Keep it and the travel mug as separate options under $70.",
      },
    ],
  },
  {
    title: "Creative gifts under $35",
    brief: examples.creative,
    turns: [
      {
        scouts: [
          { name: "Art Supply Scout", persona: "Watercolor materials specialist", focus: "Find a compact gift for someone who paints." },
          { name: "Gift Fit Scout", persona: "Practical art gift researcher", focus: "Look for gifts they can use with supplies they already own." },
        ],
        findings: [
          { names: ["Watercolor brush set"], note: "The $28 brush set looks useful for a painter." },
          { names: ["Large acrylic starter kit"], note: "I found a $34 kit, though acrylics are a different medium." },
        ],
        review: "The brushes need extra paint to make a complete gift. The acrylic kit strays from the brief. Look for a self-contained watercolor set.",
      },
      {
        scouts: [
          { name: "Travel Paint Scout", persona: "Field sketching specialist", focus: "Find a self-contained watercolor set that packs easily." },
          { name: "Kit Contents Scout", persona: "Art kit completeness researcher", focus: "Check what the set includes and what they need to supply." },
        ],
        findings: [
          { names: ["Pocket watercolor set"], note: "The $32 pocket watercolor set includes paints for a quick sketch." },
          { names: ["Pocket watercolor set"], note: "Agreed. It’s compact and works with paper they already own." },
        ],
        review: "Shortlist the pocket watercolor set. It matches their interests and stays within $35.",
      },
    ],
  },
];

export function createDemoRun(scenario) {
  const report = runSample({ ...scenario.brief, occasion: "Christmas" });
  const reviewer = {
    id: "review", name: "Gift Reviewer", persona: "Retail and budget specialist",
    focus: "Check the fit and total cost, then share feedback for the next turn.",
  };
  const researchTurns = scenario.turns.length;
  const event = (kind, role, turn, extra = {}) => ({ kind, roleId: role.id, role: role.name, turn, ...extra });
  const post = (role, turn, text, type) => ({
    kind: "board-post", message: { author: role.name, roleId: role.id, turn, text, type },
  });
  const events = [];

  for (const [index, { scouts: roles, findings, review }] of scenario.turns.entries()) {
    const turn = index + 1;
    const scouts = roles.map((role, slot) => ({ ...role, id: `scout-${turn}-${slot + 1}` }));
    const candidates = new Map();
    const assignments = turn === 1 ? [...scouts, reviewer] : scouts;
    events.push(
      { kind: "planning-start", turn, researchTurns },
      { kind: "team-plan", scouts, reviewer, turn, researchTurns, planned: true },
      ...assignments.map((role) => post(role, turn, `${role.persona} · ${role.focus}`, "assignment")),
      { kind: "turn-start", turn, researchTurns },
      ...scouts.map((role) => event("scout-start", role, turn)),
    );
    for (const [scoutIndex, { names, note }] of findings.entries()) {
      const scout = scouts[scoutIndex];
      const leads = names.map((name) => {
        if (!candidates.has(name)) candidates.set(name, { name, scouts: [] });
        const candidate = candidates.get(name);
        candidate.scouts.push({ role: scout.name, roleId: scout.id });
        return candidate;
      });
      events.push(post(scout, turn, note, "highlight"), event("scout-handoff", scout, turn, { candidates: leads }));
    }
    events.push(
      event("review-start", reviewer, turn, { candidates: [...candidates.values()] }),
      post(reviewer, turn, review, turn === researchTurns ? "verified" : "decision"),
      event("review-complete", reviewer, turn),
      { kind: "turn-complete", turn, researchTurns },
    );
  }
  return { events, report };
}
