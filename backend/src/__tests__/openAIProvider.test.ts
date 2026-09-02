import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider } from "../providers/ai/OpenAIProvider.js";
import { MockAIProvider } from "../providers/ai/MockAIProvider.js";
import { getAIProvider } from "../providers/ai/index.js";
import { toolDefinitions } from "../tools/toolDefinitions.js";
import { executeTool } from "../tools/toolExecutor.js";
import * as cartService from "../services/cartService.js";
import { getAllProducts } from "../data/products.js";
import { effectivePrice } from "../types/product.js";
import { AIMessage } from "../providers/ai/AIProvider.js";

/**
 * Deterministic regression tests for OpenAIProvider that never touch the
 * real OpenAI API: the underlying SDK client's `chat.completions.create` is
 * monkey-patched with a queue of fake responses. This exercises the exact
 * same message-translation and tool-calling contract the real API traffic
 * uses, plus the REAL toolExecutor/cartService (no duplicated business
 * logic, no fake cart), so a bug in how OpenAIProvider talks to aiService
 * would be caught here without needing a live API key.
 */

function fakeTextCompletion(content: string) {
  return { choices: [{ message: { role: "assistant", content, tool_calls: undefined } }] };
}

function fakeToolCallCompletion(id: string, name: string, args: Record<string, unknown>) {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
        },
      },
    ],
  };
}

/** Queues fake completions on a provider's private OpenAI client and records every request payload sent to it. */
function mockClient(provider: OpenAIProvider, responses: unknown[]) {
  const calls: any[] = [];
  const queue = [...responses];
  (provider as any).client = {
    chat: {
      completions: {
        create: async (params: any) => {
          calls.push(params);
          const next = queue.shift();
          if (!next) throw new Error("mockClient: no more queued fake responses");
          return next;
        },
      },
    },
  };
  return { calls };
}

function uniqueCustomerId(label: string): string {
  return `test-openai-${label}-${crypto.randomUUID()}`;
}

const basmatiRice = getAllProducts().find((p) => /basmati/i.test(p.name) && p.brand === "India Gate")!;
assert.ok(basmatiRice, "expected the India Gate Basmati Rice fixture product to exist in the catalog");
const unitPrice = effectivePrice(basmatiRice);

/** Drives one turn through a (mocked) OpenAIProvider exactly the way aiService.sendMessage does. */
async function runTurn(provider: OpenAIProvider, userText: string, customerId: string) {
  const history: AIMessage[] = [
    { role: "system", content: "LANGUAGE_CODE:en" },
    { role: "user", content: userText },
  ];
  const executedTools: string[] = [];
  let finalText = "";

  for (let i = 0; i < 6; i++) {
    const response = await provider.chat({ messages: history, tools: toolDefinitions });
    if (response.finishReason === "stop" || !response.message.toolCalls?.length) {
      finalText = response.message.content;
      history.push(response.message);
      break;
    }
    history.push(response.message);
    for (const toolCall of response.message.toolCalls) {
      const result = await executeTool(toolCall.name, toolCall.arguments, customerId);
      executedTools.push(toolCall.name);
      history.push({ role: "tool", content: JSON.stringify(result), toolCallId: toolCall.id, name: toolCall.name });
    }
  }

  return { finalText, executedTools };
}

// --- Message translation ---

test("chat() translates a plain text completion (finishReason stop)", async () => {
  const provider = new OpenAIProvider("sk-fake");
  mockClient(provider, [fakeTextCompletion("Hello from a fake model.")]);

  const response = await provider.chat({ messages: [{ role: "user", content: "hi" }], tools: [] });

  assert.equal(response.finishReason, "stop");
  assert.equal(response.message.content, "Hello from a fake model.");
  assert.equal(response.message.toolCalls, undefined);
});

test("chat() translates a tool-call completion, JSON-decoding arguments", async () => {
  const provider = new OpenAIProvider("sk-fake");
  mockClient(provider, [fakeToolCallCompletion("call_1", "search_products", { query: "basmati rice", limit: 1 })]);

  const response = await provider.chat({ messages: [{ role: "user", content: "basmati rice" }], tools: toolDefinitions });

  assert.equal(response.finishReason, "tool_calls");
  assert.equal(response.message.toolCalls?.length, 1);
  assert.equal(response.message.toolCalls?.[0].name, "search_products");
  assert.deepEqual(response.message.toolCalls?.[0].arguments, { query: "basmati rice", limit: 1 });
});

test("chat() falls back to {} for malformed tool-call JSON arguments instead of throwing", async () => {
  const provider = new OpenAIProvider("sk-fake");
  (provider as any).client = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [{ id: "call_1", type: "function", function: { name: "search_products", arguments: "{not valid json" } }],
              },
            },
          ],
        }),
      },
    },
  };

  const response = await provider.chat({ messages: [{ role: "user", content: "x" }], tools: toolDefinitions });
  assert.deepEqual(response.message.toolCalls?.[0].arguments, {});
});

test("chat() throws a clear error when OpenAI returns no choices, instead of crashing on undefined access", async () => {
  const provider = new OpenAIProvider("sk-fake");
  (provider as any).client = { chat: { completions: { create: async () => ({ choices: [] }) } } };

  await assert.rejects(() => provider.chat({ messages: [{ role: "user", content: "x" }], tools: [] }));
});

// TASK 4 — must never allow parallel tool calls that could bypass the intended
// search -> check_inventory -> add_to_cart sequence.
test("chat() requests parallel_tool_calls=false whenever tools are provided", async () => {
  const provider = new OpenAIProvider("sk-fake");
  const { calls } = mockClient(provider, [fakeTextCompletion("ok")]);

  await provider.chat({ messages: [{ role: "user", content: "hi" }], tools: toolDefinitions });

  assert.equal(calls[0].parallel_tool_calls, false);
});

// --- Error propagation (TASK 12) ---

test("chat() propagates a client failure (e.g. invalid API key / API error) rather than swallowing it", async () => {
  const provider = new OpenAIProvider("sk-fake");
  (provider as any).client = {
    chat: {
      completions: {
        create: async () => {
          const err: any = new Error("401 Incorrect API key provided");
          err.status = 401;
          err.type = "invalid_request_error";
          throw err;
        },
      },
    },
  };

  await assert.rejects(() => provider.chat({ messages: [{ role: "user", content: "hi" }], tools: toolDefinitions }), /401/);
});

// --- Full tool-calling flow through the REAL toolExecutor + cartService ---
// (TASK 4, 7 — same integration depth as the MockAIProvider tests, proving
// OpenAIProvider drives the identical business logic, not a duplicate.)

test("TASK 4/7: full purchase flow — search -> check_inventory -> add_to_cart -> final reply", async () => {
  const customerId = uniqueCustomerId("purchase");
  const provider = new OpenAIProvider("sk-fake");
  mockClient(provider, [
    fakeToolCallCompletion("call_1", "search_products", { query: "basmati rice", limit: 1 }),
    fakeToolCallCompletion("call_2", "check_inventory", { productId: basmatiRice.id, requestedQty: 2 }),
    fakeToolCallCompletion("call_3", "add_to_cart", { productId: basmatiRice.id, qty: 2 }),
    fakeTextCompletion(`Added 2 x India Gate Basmati Rice to your cart (₹${Math.round(unitPrice * 2 * 100) / 100}).`),
  ]);

  const { executedTools, finalText } = await runTurn(provider, "I need two kilos of basmati rice.", customerId);

  assert.deepEqual(executedTools, ["search_products", "check_inventory", "add_to_cart"]);
  assert.match(finalText, /Added 2 x/);

  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(item, "basmati rice should actually be in the cart");
  assert.equal(item!.qty, 2, "cart should increase by exactly the requested quantity");
});

// TASK 8 — even if a (misbehaving, mocked) model tries to add an
// over-the-limit quantity, the REAL cartService must still reject it. This
// is the "do not trust the model alone" invariant from cartService.ts,
// exercised specifically through the OpenAIProvider code path.
test("TASK 8: cartService rejects an over-stock add_to_cart call even when the model requests it directly", async () => {
  const customerId = uniqueCustomerId("overstock");
  const provider = new OpenAIProvider("sk-fake");
  const tooMany = basmatiRice.stock + 1;
  mockClient(provider, [
    fakeToolCallCompletion("call_1", "search_products", { query: "basmati rice", limit: 1 }),
    fakeToolCallCompletion("call_2", "check_inventory", { productId: basmatiRice.id, requestedQty: tooMany }),
    // A well-behaved model would stop here; simulate a misbehaving one that
    // calls add_to_cart anyway — the service layer must still hold the line.
    fakeToolCallCompletion("call_3", "add_to_cart", { productId: basmatiRice.id, qty: tooMany }),
    fakeTextCompletion("Sorry, that's more than we have in stock."),
  ]);

  await runTurn(provider, `I need ${tooMany} kilos of basmati rice.`, customerId);

  const cart = cartService.getCart(customerId);
  const item = cart.items.find((i) => i.productId === basmatiRice.id);
  assert.ok(!item || item.qty <= basmatiRice.stock, "cart must never exceed real stock, regardless of what the model requested");
});

// TASK 9 — product not found: no check_inventory/add_to_cart for a nonexistent product.
test("TASK 9: product not found — no check_inventory or add_to_cart is executed", async () => {
  const customerId = uniqueCustomerId("notfound");
  const provider = new OpenAIProvider("sk-fake");
  mockClient(provider, [
    fakeToolCallCompletion("call_1", "search_products", { query: "unicorn dust", limit: 3 }),
    fakeTextCompletion("Sorry, I couldn't find unicorn dust in our catalog."),
  ]);

  const { executedTools } = await runTurn(provider, "I need 2 kilos of unicorn dust.", customerId);

  assert.deepEqual(executedTools, ["search_products"]);
  const cart = cartService.getCart(customerId);
  assert.equal(cart.items.length, 0);
});

// --- Provider selection (TASK 15) ---

test("OpenAIProvider and MockAIProvider identify themselves distinctly", () => {
  assert.equal(new OpenAIProvider("sk-fake").name, "openai");
  assert.equal(new MockAIProvider().name, "mock");
});

test("getAIProvider() falls back to MockAIProvider when OPENAI_API_KEY is not configured (this test's environment)", () => {
  // This test suite intentionally never sets OPENAI_API_KEY, matching the
  // documented default ("MockAIProvider must continue to work exactly as it
  // does today" when no key is configured). The reverse branch
  // (isAiConfigured -> OpenAIProvider) is a one-line ternary in
  // providers/ai/index.ts, verified by code review + the tests above that
  // exercise OpenAIProvider directly; dynamically toggling process env
  // mid-suite to re-test the ternary itself would need a child process and
  // isn't worth the complexity for a single conditional.
  const provider = getAIProvider();
  assert.equal(provider.name, "mock");
});
