import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ARTICLE_COVER_TOOL_NAME,
  ARTICLE_ILLUSTRATION_TOOL_NAME,
  createImageMcpServer,
  EDIT_IMAGE_TOOL_NAME,
  formatToolResult,
  GENERATE_IMAGE_TOOL_NAME
} from "./index.js";

test("exports the expected MCP tool name", () => {
  assert.equal(GENERATE_IMAGE_TOOL_NAME, "generate_image");
  assert.equal(EDIT_IMAGE_TOOL_NAME, "edit_image");
  assert.equal(ARTICLE_COVER_TOOL_NAME, "article_cover");
  assert.equal(ARTICLE_ILLUSTRATION_TOOL_NAME, "article_illustration");
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

test("all MCP tool-facing descriptions are English", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "image-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();

    for (const tool of tools.tools) {
      const toolFacingText = JSON.stringify({
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema
      });

      assert.doesNotMatch(toolFacingText, /\p{Script=Han}/u);
    }
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

test("createImageMcpServer registers the generate_image MCP tool", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "image-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    const imageTool = tools.tools.find((tool) => tool.name === GENERATE_IMAGE_TOOL_NAME);

    assert.ok(imageTool);
    assert.equal(imageTool.description, "Generate one image from a text prompt using APIYi gpt-image-2-all.");
    assert.deepEqual(imageTool.inputSchema.required, ["prompt"]);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

test("createImageMcpServer registers the edit_image MCP tool", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "image-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    const imageTool = tools.tools.find((tool) => tool.name === EDIT_IMAGE_TOOL_NAME);

    assert.ok(imageTool);
    assert.equal(imageTool.description, "Upload one local image and generate a new image from a prompt using APIYi gpt-image-2-all.");
    assert.deepEqual(imageTool.inputSchema.required, ["prompt", "image_path"]);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

test("createImageMcpServer registers article_cover with required product image", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "image-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    const coverTool = tools.tools.find((tool) => tool.name === ARTICLE_COVER_TOOL_NAME);

    assert.ok(coverTool);
    assert.equal(coverTool.description, "Create a 16:9 article cover from a required product image and built-in prompt.");
    assert.deepEqual(coverTool.inputSchema.required, ["title", "product_image_path"]);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

test("createImageMcpServer registers article_illustration as text-to-image", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "image-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    const illustrationTool = tools.tools.find((tool) => tool.name === ARTICLE_ILLUSTRATION_TOOL_NAME);

    assert.ok(illustrationTool);
    assert.equal(illustrationTool.description, "Create a 16:9 in-article illustration using text-to-image and a built-in prompt.");
    assert.deepEqual(illustrationTool.inputSchema.required, ["topic"]);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});
