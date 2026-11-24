import { examples, runSample } from "./sample.js";

export const demoScenarios = [
  {
    id: "white-elephant",
    title: "White Elephant under $25",
    brief: examples.whiteElephant,
    turns: [
      {
        scouts: [
          { name: "Party Game Scout", persona: "Quick group game researcher", focus: "Find a gift people can open and play at the exchange." },
          { name: "Puzzle Scout", persona: "Pocket puzzle specialist", focus: "Find a small gift that suits an unknown recipient." },
        ],
        findings: [
          { names: ["Tabletop skee-ball set"], note: "The skee-ball set lists at $24, but shipping is $7." },
          { names: ["Pocket escape-room puzzle tin"], note: "The $18 tin has a few clues people can solve together." },
        ],
        review: "Keep the puzzle tin. Find a playable desk game that leaves room for shipping.",
      },
      {
        scouts: [
          { name: "Desk Game Scout", persona: "Compact game specialist", focus: "Find a group game small enough to play at work." },
          { name: "Setup Scout", persona: "Game setup reviewer", focus: "Check whether the game needs batteries, extra equipment, or a large table." },
        ],
        findings: [
          { names: ["Mini desktop curling set"], note: "The $22 curling set includes a roll-up mat and requires no batteries." },
          { names: ["Mini desktop curling set"], note: "A small flat table is enough to start a round." },
        ],
        review: "Shortlist the curling set and puzzle tin. Both can be played at the exchange. Check final delivery costs.",
      },
    ],
  },
  {
    id: "coffee",
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
    id: "outdoors",
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
    id: "creative",
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
  {
    id: "chocolate",
    title: "Chocolate under $55",
    brief: examples.chocolate,
    turns: [
      {
        scouts: [
          { name: "Bean-to-Bar Scout", persona: "Craft chocolate curator", focus: "Find a dark chocolate tasting flight." },
          { name: "Truffle Scout", persona: "Chocolate gift specialist", focus: "Check boxed truffle assortments." },
        ],
        findings: [
          { names: ["Six-bar tasting set"], note: "The six-bar set has a tasting guide, but the retailer lists it at $80." },
          { names: ["Dark chocolate truffle assortment"], note: "The $50 assortment fits the brief, but its retailer page shows it is sold out." },
        ],
        review: "Neither lead works. Look for a smaller dark chocolate box that leaves room for shipping.",
      },
      {
        scouts: [
          { name: "Small Box Scout", persona: "Gift size and value researcher", focus: "Use the reviewer's feedback to check smaller assortments." },
          { name: "Tasting Guide Scout", persona: "Guided tasting specialist", focus: "Check whether a lower-priced box still works as a tasting gift." },
        ],
        findings: [
          { names: ["Dark chocolate truffle tasting box"], note: "I found the nine-piece dark chocolate box for $38. That leaves $17 for shipping." },
          { names: ["Dark chocolate truffle tasting box"], note: "The nine-piece box includes a tasting guide, so it still fits the original brief." },
        ],
        review: "Shortlist the $38 tasting box. Confirm the final shipping fee and delivery date before buying.",
      },
    ],
  },
];

export function createDemoRun(scenario) {
  const report = runSample(scenario.brief);
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
