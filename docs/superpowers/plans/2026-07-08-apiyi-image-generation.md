# APIYi Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a TypeScript MCP tool named `generate_image` that sends a prompt to APIYi `gpt-image-2-all` and returns the generated image result.

**Architecture:** Keep APIYi HTTP logic in `src/apiyi.ts` and MCP server/tool registration in `src/index.ts`. Unit tests inject fake `fetch` functions and call exported tool helpers directly, so verification does not require live network access or a running MCP client.

**Tech Stack:** TypeScript, Node.js built-in test runner, `@modelcontextprotocol/sdk`, `zod`.

## Global Constraints

- API key is read from `APIYI_API_KEY`.
- API endpoint is `https://api.apiyi.com/v1/images/generations`.
- Model is fixed to `gpt-image-2-all`.
- `response_format` supports only `url` and `b64_json`; default is `url`.
- Do not expose `size`, `n`, `quality`, or `aspect_ratio`.
- New functions, properties, and classes must have complete Chinese comments.

---

### Task 1: APIYi HTTP Client

**Files:**
- Create: `src/apiyi.ts`
- Create: `src/apiyi.test.ts`

**Interfaces:**
- Produces: `type ResponseFormat = "url" | "b64_json"`
- Produces: `interface GenerateImageOptions { prompt: string; responseFormat?: ResponseFormat; apiKey?: string; fetchImpl?: typeof fetch; }`
- Produces: `interface GenerateImageResult { created?: number; usage?: unknown; url?: string; b64_json?: string; }`
- Produces: `async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult>`

- [x] **Step 1: Write failing tests**

Create `src/apiyi.test.ts` with tests that call `generateImage` before it exists:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { generateImage } from "./apiyi.js";

test("generateImage defaults to url and sends APIYi request fields", async () => {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({
      created: 1778037331,
      usage: { total_tokens: 2104 },
      data: [{ url: "https://r2.example/image.png" }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await generateImage({
    prompt: "横版 16:9 电影画幅，黄昏时的海边老灯塔",
    apiKey: "sk-test",
    fetchImpl: fakeFetch
  });

  assert.equal(calls.length, 1);
  assert.equal(String(calls[0].input), "https://api.apiyi.com/v1/images/generations");
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: "Bearer sk-test",
    "Content-Type": "application/json"
  });
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    model: "gpt-image-2-all",
    prompt: "横版 16:9 电影画幅，黄昏时的海边老灯塔",
    response_format: "url"
  });
  assert.deepEqual(result, {
    created: 1778037331,
    usage: { total_tokens: 2104 },
    url: "https://r2.example/image.png"
  });
});

test("generateImage supports b64_json responses", async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    data: [{ b64_json: "data:image/png;base64,abc" }]
  }), { status: 200 });

  const result = await generateImage({
    prompt: "1024x1024 方形 LOGO，极简猫咪线条",
    responseFormat: "b64_json",
    apiKey: "sk-test",
    fetchImpl: fakeFetch
  });

  assert.deepEqual(result, { b64_json: "data:image/png;base64,abc" });
});

test("generateImage rejects missing API key", async () => {
  await assert.rejects(
    () => generateImage({ prompt: "test", apiKey: "", fetchImpl: async () => new Response("{}") }),
    /APIYI_API_KEY is required/
  );
});

test("generateImage reports non-2xx APIYi responses", async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 });

  await assert.rejects(
    () => generateImage({ prompt: "test", apiKey: "sk-test", fetchImpl: fakeFetch }),
    /APIYi request failed with status 429: quota exceeded/
  );
});

test("generateImage reports missing expected image field", async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({ data: [{}] }), { status: 200 });

  await assert.rejects(
    () => generateImage({ prompt: "test", apiKey: "sk-test", fetchImpl: fakeFetch }),
    /APIYi response did not include url/
  );
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: TypeScript build fails because `src/apiyi.ts` does not exist.

- [x] **Step 3: Implement APIYi client**

Create `src/apiyi.ts` with exported types and `generateImage`. Add complete Chinese comments for all exported functions, interfaces, properties, and helper functions.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test`

Expected: APIYi tests pass.

### Task 2: MCP Tool Registration

**Files:**
- Modify: `src/index.ts`
- Create: `src/index.test.ts`

**Interfaces:**
- Consumes: `generateImage(options: GenerateImageOptions): Promise<GenerateImageResult>`
- Produces: `const GENERATE_IMAGE_TOOL_NAME = "generate_image"`
- Produces: `function createImageMcpServer(): McpServer`
- Produces: `function formatToolResult(result: GenerateImageResult): string`
- Produces: `async function runStdioServer(): Promise<void>`

- [x] **Step 1: Write failing tests**

Create `src/index.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { formatToolResult, GENERATE_IMAGE_TOOL_NAME } from "./index.js";

test("exports the expected MCP tool name", () => {
  assert.equal(GENERATE_IMAGE_TOOL_NAME, "generate_image");
});

test("formatToolResult returns readable JSON text", () => {
  const text = formatToolResult({
    created: 1778037331,
    usage: { total_tokens: 2104 },
    url: "https://r2.example/image.png"
  });

  assert.deepEqual(JSON.parse(text), {
    created: 1778037331,
    usage: { total_tokens: 2104 },
    url: "https://r2.example/image.png"
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: TypeScript build fails because `src/index.ts` does not export these symbols.

- [x] **Step 3: Implement MCP server entry**

Create `src/index.ts` with `McpServer`, `StdioServerTransport`, zod input schema, `generate_image` tool callback, and direct-run guard for the CLI entry point.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test`

Expected: all tests pass.

### Task 3: Final Verification

**Files:**
- Review: `src/apiyi.ts`
- Review: `src/index.ts`
- Review: `src/*.test.ts`

- [x] **Step 1: Run full verification**

Run: `npm test`

Expected: build succeeds and Node test runner reports all tests passed.

- [x] **Step 2: Inspect git diff**

Run: `git diff -- src docs/superpowers/plans/2026-07-08-apiyi-image-generation.md`

Expected: diff contains only the planned APIYi MCP implementation and tests.
