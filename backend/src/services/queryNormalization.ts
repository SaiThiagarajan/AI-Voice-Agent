import { SupportedLanguageCode } from "../types/language.js";

/**
 * Normalizes a customer's raw utterance -- in any supported language, in any
 * mix of native script / romanized / code-switched text (e.g. Hindi written
 * partly in Devanagari and partly transliterated English, like "basmati rice"
 * spelled "बासमती राइस") -- into a structured shopping intent:
 *
 *   "मुझे दो किलो बासमती राइस दे दो"
 *     -> { productQuery: "basmati rice", quantity: 2, unit: "kg" }
 *
 * This is deliberately a small, table-driven normalizer, NOT a general NLP
 * pipeline: each language has a short lexicon of number words, unit words,
 * grocery-domain product words, and filler/verb words to discard. Real
 * open-ended language understanding is OpenAIProvider's job -- this exists
 * so MockAIProvider (and any other caller) can reliably extract "how much of
 * what" for the primary shopping flow without a real LLM.
 *
 * `search_products` matches on ANY token in the query (OR-matching, see
 * productService.ts), so this only needs to surface ONE recognizable
 * English token per product mention -- it does not need to translate every
 * word correctly to work.
 *
 * Cross-language tolerance: if the customer's spoken language doesn't match
 * the selected `language` (e.g. they speak Hindi while "English" is
 * selected), the primary lexicon is tried first but native-script tokens it
 * doesn't recognize are also checked against every OTHER language's
 * lexicon -- scripts (Devanagari/Tamil/Telugu) never collide with each other
 * or with Latin, so this is safe. That fallback is intentionally restricted
 * to non-ASCII tokens only: several languages' number words are commonly
 * romanized in Latin script (Hindi "do" = 2, "ek" = 1, ...), and those DO
 * collide with ordinary English words ("do you have...") -- falling back to
 * them for plain ASCII input would misfire constantly, so plain-ASCII
 * tokens are only ever matched against the primary/English lexicon.
 */

export interface NormalizedShoppingIntent {
  /** English-biased search query to hand to search_products. Empty string if nothing recognizable remained. */
  productQuery: string;
  /** Requested amount. Undefined if no quantity was stated at all. */
  quantity: number | undefined;
  /** Canonical unit ("kg" | "g" | "l" | "ml" | "pcs"), or null if no unit word was recognized. */
  unit: string | null;
}

interface LanguageLexicon {
  /** Native/romanized number word -> value. */
  numberWords: Record<string, number>;
  /** Native unit word -> canonical unit. */
  unitWords: Record<string, string>;
  /** Native grocery-domain word -> canonical English word. */
  productWords: Record<string, string>;
  /** Native filler/intent/verb words to discard entirely (pronouns, "give me", polite particles, ...). */
  fillerWords: Set<string>;
}

// Unit and filler words that show up in English regardless of the selected
// language (e.g. a Hindi speaker saying "kg", or an English request itself).
const ENGLISH_UNIT_WORDS: Record<string, string> = {
  kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg", kg: "kg", kgs: "kg",
  gram: "g", grams: "g", gm: "g", g: "g",
  litre: "l", litres: "l", liter: "l", liters: "l", l: "l",
  ml: "ml", millilitre: "ml", millilitres: "ml",
  packet: "pcs", packets: "pcs", pack: "pcs", packs: "pcs",
  bottle: "pcs", bottles: "pcs", piece: "pcs", pieces: "pcs", pcs: "pcs",
  dozen: "pcs", unit: "pcs", units: "pcs",
};

const ENGLISH_FILLER_WORDS = new Set([
  "i", "need", "want", "would", "like", "please", "get", "me", "give", "can", "you", "could",
  "order", "buy", "purchase", "add", "to", "my", "cart", "of", "a", "an", "the", "some", "for",
  "do", "does", "have", "has", "is", "are", "there", "any", "got",
  // Correction/verb words ("actually make that 3 kilos of basmati rice")
  // that should never end up inside the product search query.
  "actually", "make", "that", "it", "change", "instead", "only", "just",
  "increase", "decrease", "update", "correct", "really", "again",
  // Removal verb words ("remove the basmati rice", "take that out").
  "remove", "delete", "take", "out", "rid", "anymore", "don't", "dont",
  // Additive-purchase words ("also add oil") and quantity filler ("2 more
  // kilos") that shouldn't leak into the product search query.
  "also", "and", "more",
]);

const LEXICONS: Record<SupportedLanguageCode, LanguageLexicon> = {
  en: {
    numberWords: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
    unitWords: {},
    productWords: {},
    fillerWords: new Set(),
  },
  hi: {
    numberWords: {
      // Devanagari
      "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
      // common romanized spellings -- NOT used for cross-language fallback
      // (see module docs) since these are plain ASCII and would collide
      // with English words; they still work when Hindi is the primary
      // selected language.
      ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5,
    },
    unitWords: {
      "किलो": "kg", "किलोग्राम": "kg", "ग्राम": "g", "लीटर": "l", "मिलीलीटर": "ml", "पैकेट": "pcs",
    },
    productWords: {
      "चावल": "rice", "राइस": "rice", "बासमती": "basmati", "दूध": "milk", "तेल": "oil",
      "आटा": "atta", "दाल": "dal", "बिस्कुट": "biscuits", "चीनी": "sugar",
    },
    // "दे दो" ("give [it]") is a common closing verb phrase whose second word
    // is spelled identically to the number 2 ("दो") -- only the FIRST
    // occurrence of a number word in the utterance is ever treated as the
    // quantity (see normalizeShoppingIntent), so it's safe to also list "दो"
    // here to strip any later, non-quantity occurrence of it.
    fillerWords: new Set([
      "मुझे", "चाहिए", "दे", "दो", "दीजिए", "कृपया", "हमें", "असल", "में", "बदल", "कर", "हटाओ", "हटा", "निकालो",
      "इसे", "उसे", "यह", "वह", // pronouns ("it"/"that") in a correction like "असल में इसे 3 किलो कर दो"
    ]),
  },
  ta: {
    numberWords: { "ஒன்று": 1, "இரண்டு": 2, "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5 },
    unitWords: { "கிலோ": "kg", "கிலோகிராம்": "kg", "கிராம்": "g", "லிட்டர்": "l" },
    productWords: {
      "அரிசி": "rice", "பாஸ்மதி": "basmati", "பால்": "milk", "எண்ணெய்": "oil",
      "மாவு": "atta", "பருப்பு": "dal", "பிஸ்கட்": "biscuits", "சர்க்கரை": "sugar",
    },
    fillerWords: new Set([
      "எனக்கு", "வேண்டும்", "தயவுசெய்து", "கொடு", "கொடுங்கள்", "உண்மையில்", "மாற்று", "பதிலாக", "நீக்கு", "எடுத்துவிடு",
      "அதை", "இதை", "ஆக", // pronouns ("it"/"this") + "as/to" in a correction like "உண்மையில் அதை 3 கிலோ ஆக மாற்று"
    ]),
  },
  te: {
    numberWords: { "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5 },
    unitWords: {
      // "కిలోలు" (nominative plural, "kilos") and "కిలోల" (oblique/genitive
      // form used right before a noun, as in "కిలోల బాస్మతి బియ్యం" -- "kilos
      // OF basmati rice") are both real inflections of "కిలో" a customer
      // will actually say.
      // "కిలోలకి" (dative, "to/for X kilos") shows up in corrections like
      // "దాన్ని 3 కిలోలకి మార్చు" ("change it to 3 kilos").
      "కిలో": "kg", "కిలోలు": "kg", "కిలోల": "kg", "కిలోలకి": "kg", "కిలోగ్రాము": "kg", "గ్రాము": "g", "లీటరు": "l",
    },
    productWords: {
      "బియ్యం": "rice", "బాస్మతి": "basmati", "పాలు": "milk", "నూనె": "oil",
      "పిండి": "atta", "పప్పు": "dal", "బిస్కెట్లు": "biscuits", "చక్కెర": "sugar",
    },
    fillerWords: new Set([
      "నాకు", "కావాలి", "దయచేసి", "ఇవ్వండి", "నిజానికి", "మార్చు", "బదులుగా", "తీసివేయి", "తొలగించు",
      "దాన్ని", "దీన్ని", // pronouns ("it"/"this") in a correction like "నిజానికి దాన్ని 3 కిలోలకి మార్చు"
    ]),
  },
};

const ALL_LANGUAGE_CODES = Object.keys(LEXICONS) as SupportedLanguageCode[];

function isNonAscii(token: string): boolean {
  for (let i = 0; i < token.length; i++) {
    if (token.charCodeAt(i) > 127) return true;
  }
  return false;
}

function stripPunctuation(token: string): string {
  return token.replace(/[.,!?;:।"'']/g, "");
}

/** Looks up `token` in `primaryLanguage`'s dictionary first, then -- only for non-ASCII (native-script) tokens -- every other language's dictionary. */
function lookupValue<T>(
  token: string,
  lower: string,
  primaryLanguage: SupportedLanguageCode,
  selectDict: (lexicon: LanguageLexicon) => Record<string, T>
): T | undefined {
  const primaryDict = selectDict(LEXICONS[primaryLanguage]);
  const primaryHit = primaryDict[token] ?? primaryDict[lower];
  if (primaryHit !== undefined) return primaryHit;
  if (!isNonAscii(token)) return undefined;

  for (const code of ALL_LANGUAGE_CODES) {
    if (code === primaryLanguage) continue;
    const hit = selectDict(LEXICONS[code])[token];
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Same fallback rule as `lookupValue`, for the filler-word sets. */
function isFillerWord(token: string, lower: string, primaryLanguage: SupportedLanguageCode): boolean {
  const primarySet = LEXICONS[primaryLanguage].fillerWords;
  if (primarySet.has(token) || primarySet.has(lower)) return true;
  if (!isNonAscii(token)) return false;

  for (const code of ALL_LANGUAGE_CODES) {
    if (code === primaryLanguage) continue;
    if (LEXICONS[code].fillerWords.has(token)) return true;
  }
  return false;
}

export function normalizeShoppingIntent(rawText: string, language: SupportedLanguageCode): NormalizedShoppingIntent {
  const primaryLanguage: SupportedLanguageCode = LEXICONS[language] ? language : "en";
  const tokens = rawText.split(/\s+/).filter(Boolean).map(stripPunctuation);

  let quantity: number | undefined;
  let quantityIndex = -1;
  const unitIndices = new Set<number>();
  let unit: string | null = null;

  // Pass 1: find the quantity -- a literal digit takes priority over a
  // number word, and only the FIRST match counts (see the "दे दो" note above).
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d+(\.\d+)?$/.test(tokens[i])) {
      quantity = parseFloat(tokens[i]);
      quantityIndex = i;
      break;
    }
  }
  if (quantity === undefined) {
    for (let i = 0; i < tokens.length; i++) {
      const lower = tokens[i].toLowerCase();
      const value = lookupValue(tokens[i], lower, primaryLanguage, (l) => l.numberWords);
      if (value !== undefined) {
        quantity = value;
        quantityIndex = i;
        break;
      }
    }
  }

  // Pass 2: find unit word(s) -- native first (with cross-language fallback
  // for native-script tokens), then plain English (units are sometimes said
  // in English regardless of the spoken language, e.g. "किलो" vs "kg"). All
  // matches are stripped from the query, but only the first sets the unit.
  for (let i = 0; i < tokens.length; i++) {
    const lower = tokens[i].toLowerCase();
    const native = lookupValue(tokens[i], lower, primaryLanguage, (l) => l.unitWords);
    const canonical = native ?? ENGLISH_UNIT_WORDS[lower];
    if (canonical) {
      unitIndices.add(i);
      if (unit === null) unit = canonical;
    }
  }

  // Pass 3: whatever's left (minus the quantity token, unit token(s), and
  // filler/verb words) is the product query, translating any recognized
  // grocery-domain word to its English equivalent along the way.
  const queryTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i === quantityIndex || unitIndices.has(i)) continue;
    const raw = tokens[i];
    const lower = raw.toLowerCase();
    if (ENGLISH_FILLER_WORDS.has(lower)) continue;
    if (isFillerWord(raw, lower, primaryLanguage)) continue;
    const translated = lookupValue(raw, lower, primaryLanguage, (l) => l.productWords);
    queryTokens.push(translated ?? raw);
  }

  return { productQuery: queryTokens.join(" ").trim(), quantity, unit };
}

// --- Utterance intent (price / inventory questions vs. purchase requests) ---
//
// A stated quantity alone ("2 kilos of basmati rice") is ambiguous between an
// instruction ("I need 2 kilos...") and a question ("How much is 2 kilos of
// basmati rice?"). MockAIProvider must not treat the latter as a purchase.
// These markers are checked across ALL supported languages regardless of the
// selected UI language (same cross-language tolerance as normalizeShoppingIntent
// above) -- they're short, distinctive multi-character phrases in each script,
// so there's no realistic collision risk in checking all of them at once.

const CORRECTION_MARKERS = [
  // English
  "actually", "make that", "make it", "change that to", "change it to", "instead",
  "i only want", "i just want", "increase it to", "decrease it to", "increase to",
  "decrease to", "update that to", "update it to", "correct that to", "actually give me",
  "actually i want", "make the",
  // Hindi
  "असल में", "बदल", "कर दो",
  // Tamil
  "உண்மையில்", "மாற்று", "பதிலாக",
  // Telugu
  "నిజానికి", "మార్చు", "బదులుగా",
];

const REMOVE_MARKERS = [
  // English
  "remove", "delete", "take out", "take it out", "get rid of", "don't want it anymore",
  // Hindi
  "हटाओ", "हटा दो", "निकालो",
  // Tamil
  "நீக்கு", "எடுத்துவிடு",
  // Telugu
  "తీసివేయి", "తొలగించు",
];

const PRICE_QUERY_MARKERS = [
  // English
  "how much is", "how much does", "how much would", "how much for", "how much",
  "what is the price", "what's the price", "price of", "cost of",
  "what does it cost", "what would it cost", "how much does it cost",
  // Hindi
  "कितना", "कीमत", "दाम", "भाव",
  // Tamil
  "எவ்வளவு", "விலை",
  // Telugu
  "ఎంత", "ధర", "వెల",
];

const INVENTORY_QUERY_MARKERS = [
  // English
  "how many", "available", "in stock", "do you have", "is there enough",
  "stock of", "left in stock", "any stock",
  // Hindi
  "कितने", "उपलब्ध", "स्टॉक",
  // Tamil
  "எத்தனை", "கையிருப்பு", "உள்ளதா", "உள்ளது",
  // Telugu
  "ఎన్ని", "నిల్వ", "అందుబాటులో",
];

// Cart-content questions ("what's in my cart", "what did I add", "tell me
// what I added", "what products do I have") — deliberately broader than a
// literal "my cart" match, since real phrasing varies a lot and this must
// never fall through to a product search (which would misfire and never
// answer the actual question). "cart" alone is a safe, unambiguous marker
// in this domain (no product/brand name contains it).
const CART_QUERY_MARKERS = [
  // English
  "cart", "did i add", "i added", "what products do i have", "what do i have",
  // Hindi ("कार्ट" is the common loanword for "cart")
  "कार्ट", "क्या जोड़ा", "क्या मंगाया",
  // Tamil
  "கார்ட்", "என்ன சேர்த்தேன்",
  // Telugu
  "కార్ట్", "ఏమి జోడించాను",
];

export type UtteranceIntent = "quantity_correction" | "remove_item" | "price_query" | "inventory_query" | "cart_query" | null;

/**
 * Classifies whether an utterance is asking ABOUT a product (price or
 * availability), asking about the CART'S CONTENTS, CORRECTING a quantity
 * already discussed, REMOVING an item, or neither — rather than instructing
 * the assistant to add something new to the cart. Checked before
 * quantity-based purchase heuristics so that a question like "How much is 2
 * kilos of basmati rice?" is never treated as a request to add 2 kilos to
 * the cart, and a correction like "actually make that 3 kilos" is never
 * treated as a fresh, additive purchase.
 */
export function detectUtteranceIntent(rawText: string): UtteranceIntent {
  const lower = rawText.toLowerCase();
  const matches = (markers: string[]) => markers.some((m) => lower.includes(m) || rawText.includes(m));
  if (matches(CORRECTION_MARKERS)) return "quantity_correction";
  if (matches(REMOVE_MARKERS)) return "remove_item";
  if (matches(CART_QUERY_MARKERS)) return "cart_query";
  if (matches(PRICE_QUERY_MARKERS)) return "price_query";
  if (matches(INVENTORY_QUERY_MARKERS)) return "inventory_query";
  return null;
}

// --- Catalog quantity/unit math (for price calculations only) ---
//
// Purchase (add_to_cart) quantities are intentionally left as literal pack
// counts everywhere else in this codebase -- unchanged by the functions
// below, which exist ONLY to answer "how much would N <unit> cost" price
// questions using the product's real pack size, never to change what
// add_to_cart adds.

export interface ParsedProductQuantity {
  value: number;
  unit: string;
}

/** Parses a catalog quantity label like "1 kg", "500 g", "750 ml", "30 pcs" into a value + canonical unit. */
export function parseProductQuantityLabel(label: string): ParsedProductQuantity | null {
  const match = label.match(/([\d.]+)\s*([a-zA-Z]+)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const rawUnit = match[2].toLowerCase();
  const unit = ENGLISH_UNIT_WORDS[rawUnit] ?? rawUnit;
  return { value, unit };
}

const UNIT_FAMILY: Record<string, "mass" | "volume" | "count"> = {
  kg: "mass", g: "mass", l: "volume", ml: "volume", pcs: "count",
};

function toBaseUnits(value: number, unit: string): number {
  return unit === "kg" || unit === "l" ? value * 1000 : value;
}

/**
 * How many catalog packs (of `productQuantityLabel`, e.g. "1 kg") does it
 * take to fulfil a request of `requestedQty` `requestedUnit` (e.g. 2 "kg")?
 * Falls back to treating `requestedQty` as a literal pack count whenever the
 * units can't be confidently converted (no unit stated, unrecognized
 * catalog label, or mismatched unit families -- e.g. asking for "kg" of a
 * product sold in "pcs").
 */
export function computePacksNeeded(requestedQty: number, requestedUnit: string | null, productQuantityLabel: string): number {
  if (!requestedUnit) return requestedQty;
  const parsed = parseProductQuantityLabel(productQuantityLabel);
  if (!parsed) return requestedQty;

  const requestedFamily = UNIT_FAMILY[requestedUnit];
  const productFamily = UNIT_FAMILY[parsed.unit];
  if (!requestedFamily || !productFamily || requestedFamily !== productFamily) return requestedQty;

  return toBaseUnits(requestedQty, requestedUnit) / toBaseUnits(parsed.value, parsed.unit);
}
