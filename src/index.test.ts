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

/** 验证批量图标工具已注册，且数量与描述不匹配时返回可读错误。 */
test("registers generate_icons and rejects mismatched count", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "icons-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const listed = await client.listTools();
    const tool = listed.tools.find((item) => item.name === "generate_icons");
    assert.ok(tool);
    assert.deepEqual(tool.inputSchema.required, ["count", "descriptions"]);
    const result = await client.callTool({ name: "generate_icons", arguments: { count: 2, descriptions: ["home"] } });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /exactly count/);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

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

test("createImageMcpServer registers article_cover with optional product and logo images", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "image-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    const coverTool = tools.tools.find((tool) => tool.name === ARTICLE_COVER_TOOL_NAME);

    assert.ok(coverTool);
    assert.equal(coverTool.description, "Create a 16:9 article cover with optional product and logo images.");
    assert.deepEqual(coverTool.inputSchema.required, ["title"]);
    assert.ok(coverTool.inputSchema.properties?.product_image_path);
    assert.ok(coverTool.inputSchema.properties?.logo_image_path);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

test("createImageMcpServer registers article_illustration with optional product and logo images", async () => {
  const server = createImageMcpServer();
  const client = new Client({ name: "image-mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const tools = await client.listTools();
    const illustrationTool = tools.tools.find((tool) => tool.name === ARTICLE_ILLUSTRATION_TOOL_NAME);

    assert.ok(illustrationTool);
    assert.equal(illustrationTool.description, "Create a 16:9 in-article illustration with optional product and logo images.");
    assert.deepEqual(illustrationTool.inputSchema.required, ["topic"]);
    assert.ok(illustrationTool.inputSchema.properties?.product_image_path);
    assert.ok(illustrationTool.inputSchema.properties?.logo_image_path);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});
