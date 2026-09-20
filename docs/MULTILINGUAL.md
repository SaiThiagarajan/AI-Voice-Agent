# Multilingual Support

## Supported languages today

English (`en`), Tamil (`ta`), Telugu (`te`), Hindi (`hi`) — defined once in
`backend/src/types/language.ts` and mirrored in `frontend/src/types/index.ts` as
`SUPPORTED_LANGUAGES`, each with a code, display label, native label, and a BCP-47 speech locale
(e.g. `ta-IN`) used by the browser's `SpeechRecognition`/`speechSynthesis` APIs.

## How language flows through the system

1. The customer picks a language in the UI (`LanguageContext` / `LanguageSelector`), which also sets the
   locale the browser's `SpeechRecognition` listens for and its `speechSynthesis` speaks in
   (`en-IN` / `ta-IN` / `te-IN` / `hi-IN`).
2. Every message to `POST /api/agent/chat` includes `language`.
3. `aiService.buildSystemPrompt()` embeds `LANGUAGE_CODE:<code>` and an explicit instruction to reply in
   that language — this is how both `OpenAIProvider` (real model) and `MockAIProvider` (regex-based
   fallback, which parses the marker back out of the system prompt) know which language to answer in.
4. `services/localization.ts` holds hand-written phrase templates per language for every mock-provider
   response shape (product found, out of stock, added to cart, order placed, etc.) — this is what makes
   the demo fully multilingual even without an OpenAI key.
5. The browser speaks the reply back using `speechSynthesis` with the matching locale.

## Mock provider vs. real understanding

`MockAIProvider` is a bounded keyword/regex fallback, not real NLU. For English (and common
romanized Hindi phrasing) it extracts a product query and quantity directly. For native-script
Tamil/Telugu/Hindi it first runs the text through a small `NATIVE_TERM_MAP` dictionary (in
`MockAIProvider.ts`) that translates a handful of common grocery and number words — e.g. Tamil
"அரிசி"/"பாஸ்மதி" or Hindi "चावल"/"बासमती" → "rice"/"basmati" — just enough for `search_products`'
OR-token matching to find the right item. This is intentionally minimal (it only needs to surface
one recognizable English token, not translate the whole sentence) and only covers the example
phrases and staples the product spec calls out — it is **not** a substitute for real language
understanding. With `OPENAI_API_KEY` configured, `OpenAIProvider` understands all four languages
natively (including full native-script sentences, follow-up questions, and phrasing well beyond the
mock's dictionary) and this fallback logic is bypassed entirely.

## Adding a new language

1. Add an entry to `SUPPORTED_LANGUAGES` in both `backend/src/types/language.ts` and
   `frontend/src/types/index.ts` (code, label, native label, speech locale).
2. Add a matching entry to `PHRASES` in `backend/src/services/localization.ts`.
3. No other code changes are required — the AI prompt, tool-calling loop, and UI all key off the shared
   language list.

Real free-form understanding in a new language depends on the underlying OpenAI model's multilingual
capability (already broad); the mock fallback's keyword parsing is intentionally minimal and only needs
the phrase templates to produce a coherent demo reply.
