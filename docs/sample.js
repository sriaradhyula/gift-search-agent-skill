import { shortlistGifts } from "./report.js";

export const examples = {
  secretSanta: {
    recipient: "My coworker", occasion: "Secret Santa", interests: "Spicy snacks, tasting kits",
    budget: 25, currency: "USD", region: "United States", neededBy: null, exclude: "",
  },
  whiteElephant: {
    recipient: "My coworker", occasion: "White Elephant", interests: "Party games, desk puzzles",
    budget: 25, currency: "USD", region: "United States", neededBy: null, exclude: "",
  },
  coffee: {
    recipient: "My sister", occasion: "Christmas", interests: "Coffee, slow mornings",
    budget: 75, currency: "USD", region: "United States", neededBy: null, exclude: "",
  },
  garden: {
    recipient: "A friend", occasion: "Housewarming", interests: "Gardening, herbs",
    budget: 40, currency: "USD", region: "United States", neededBy: null, exclude: "",
  },
  creative: {
    recipient: "My coworker", occasion: "Thank you", interests: "Painting, watercolor",
    budget: 35, currency: "USD", region: "United States", neededBy: null, exclude: "",
  },
  outdoors: {
    recipient: "My dad", occasion: "Just because", interests: "Outdoors, picnics",
    budget: 70, currency: "USD", region: "United States", neededBy: null, exclude: "",
  },
  chocolate: {
    recipient: "A friend", occasion: "Christmas", interests: "Dark chocolate, truffles",
    budget: 55, currency: "USD", region: "United States", neededBy: null, exclude: "",
  },
};

const catalog = [
  {
    name: "Pour-over coffee set", category: "Coffee", price: 48,
    tags: "coffee brewing slow mornings kitchen drinks barista", occasions: ["Birthday", "Housewarming"],
    reason: "A hands-on brewing ritual for someone who likes to take their time with the first cup.",
    caveat: "Check whether the set includes paper filters in the right size.",
  },
  {
    name: "Insulated travel mug", category: "Everyday", price: 34,
    tags: "coffee tea travel commute work hiking outdoors drinks", occasions: ["Birthday", "Thank you"],
    reason: "Keeps their favorite coffee warm on the commute or a long morning walk.",
    caveat: "Check whether the lid seals fully if they carry it in a bag.",
  },
  {
    name: "Specialty coffee tasting flight", category: "Food & drink", price: 29,
    tags: "coffee tasting beans food drinks edible consumable", occasions: ["Birthday", "Thank you"],
    reason: "A few small roasts give them an easy way to try different beans and find a favorite.",
    caveat: "Choose whole bean or ground to match how they brew.",
  },
  {
    name: "Insulated picnic backpack", category: "Outdoors", price: 64,
    tags: "outdoors picnic picnics hiking travel camping nature", occasions: ["Birthday", "Just because"],
    reason: "Keeps snacks and drinks together for day hikes and park lunches.",
    caveat: "Check the capacity if they usually pack for a group.",
  },
  {
    name: "Windowsill herb garden kit", category: "Home & garden", price: 28,
    tags: "garden gardening plant plants herbs cooking kitchen housewarming seedlings", occasions: ["Housewarming"],
    reason: "Gives them fresh herbs to grow even if they only have a sunny windowsill.",
    caveat: "Seedlings need regular light and watering.",
  },
  {
    name: "Pocket watercolor set", category: "Creative", price: 32,
    tags: "painting paint watercolor art arts crafts creative drawing sketching travel hobby", occasions: ["Thank you", "Birthday"],
    reason: "Packs down small enough to bring along for a quick sketch outside or on a trip.",
    caveat: "Check whether watercolor paper and a brush are included.",
  },
  {
    name: "Dark chocolate truffle tasting box", category: "Food & drink", price: 38, hasCatalogPhoto: false,
    tags: "dark chocolate truffles tasting flights cacao sampler", occasions: ["Christmas"],
    reason: "Nine dark chocolate truffles and a tasting guide give your friend a few flavors to compare.",
    caveat: "Check the shipping fee and arrival date before ordering.",
  },
  {
    name: "Mini desktop curling set", category: "Games", price: 22, hasCatalogPhoto: false,
    tags: "party games desk puzzles group activity tabletop shuffleboard", occasions: ["White Elephant"],
    reason: "Turns a break-room table into a two-minute curling rink.",
    caveat: "Needs a flat table and enough space to roll out the mat.",
  },
  {
    name: "Pocket escape-room puzzle tin", category: "Puzzles", price: 18, hasCatalogPhoto: false,
    tags: "party games desk puzzles group activity riddles", occasions: ["White Elephant", "Secret Santa"],
    reason: "A few miniature puzzles are easy to pass around during the exchange.",
    caveat: "Check whether the clues are reusable if they plan to pass it on.",
  },
  {
    name: "Chili crisp tasting trio", category: "Food & drink", price: 19, hasCatalogPhoto: false,
    tags: "spicy snacks tasting kits chili crisp sampler cooking", occasions: ["Secret Santa", "Christmas"],
    reason: "Three small jars let a coworker try different levels of crunch and heat.",
    caveat: "Check the ingredients for sesame, peanuts, or other allergens.",
  },
  {
    name: "Dinner-party mystery game", category: "Games", price: 38, hasCatalogPhoto: false,
    tags: "party games puzzles group activity detective dinner", occasions: ["White Elephant"],
    reason: "Gives the recipient a ready-made game night with roles and clues for friends.",
    caveat: "Check the minimum player count and how much time a game takes.",
  },
  {
    name: "Fold-flat tabletop shuffleboard", category: "Games", price: 68, hasCatalogPhoto: false,
    tags: "party games desk puzzles group activity tabletop", occasions: ["White Elephant"],
    reason: "Packs away between gatherings and comes out when people want a quick tournament.",
    caveat: "Measure the table before choosing a board size.",
  },
];

export const sampleImage = (name) => catalog.findIndex((gift) => gift.name === name && gift.hasCatalogPhoto !== false);
const words = (text) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

export function runSample(brief) {
  const interests = words(brief.interests);
  const exclusions = brief.exclude.toLowerCase().split(/[,;\n]/).map((term) => term.trim()).filter(Boolean);
  const ranked = catalog
    .filter((gift) => brief.budget === null || gift.price <= brief.budget)
    .filter((gift) => !exclusions.some((term) => `${gift.name} ${gift.tags}`.toLowerCase().includes(term)))
    .map((gift) => {
      const terms = words(`${gift.tags} ${gift.name} ${gift.category}`);
      const matches = [...interests].filter((term) => terms.has(term)).length;
      return { gift, matches, score: matches * 2 + Number(gift.occasions.includes(brief.occasion)) };
    })
    .filter(({ matches }) => !interests.size || matches > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ gift: { name, category, price, reason, caveat } }) => ({
      name, category, price, reason, caveat, merchant: null, url: null,
    }));

  const notes = ["Illustrative products and prices from the sample catalog."];
  if (brief.neededBy) notes.push("The sample catalog has no delivery estimates.");
  return {
    version: 1, mode: "sample", brief, checkedOn: null, gifts: shortlistGifts(ranked, brief),
    notes,
  };
}
