import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { saveGeneratedImage, sanitizePromptForFilename } from "./imageFile.js";

test("sanitizePromptForFilename removes Windows invalid characters and limits length", () => {
  const sanitized = sanitizePromptForFilename('  竖版 9:16 / 手机壁纸? "赛博朋克城市雨夜"  '.repeat(8));

  assert.equal(sanitized.includes("/"), false);
  assert.equal(sanitized.includes("?"), false);
  assert.equal(sanitized.includes('"'), false);
  assert.equal(sanitized.includes(":"), false);
  assert.equal(sanitized.length <= 80, true);
  assert.equal(sanitized.startsWith("竖版 9 16 手机壁纸 赛博朋克城市雨夜"), true);
});

test("saveGeneratedImage downloads url result to prompt-named file", async () => {
  const picturesDir = await mkdtemp(path.join(tmpdir(), "image-mcp-"));
  const imageBytes = new Uint8Array([1, 2, 3, 4]);
  const fakeFetch: typeof fetch = async () => new Response(imageBytes, {
    status: 200,
    headers: { "content-type": "image/png" }
  });

  try {
    const result = await saveGeneratedImage({
      prompt: "测试 图片",
      result: { url: "https://example.test/generated.png" },
      picturesDir,
      fetchImpl: fakeFetch
    });

    assert.equal(result.savedPath, path.join(picturesDir, "测试 图片.png"));
    assert.deepEqual(await readFile(result.savedPath), Buffer.from(imageBytes));
  } finally {
    await rm(picturesDir, { recursive: true, force: true });
  }
});

test("saveGeneratedImage decodes b64_json result to prompt-named file", async () => {
  const picturesDir = await mkdtemp(path.join(tmpdir(), "image-mcp-"));

  try {
    const result = await saveGeneratedImage({
      prompt: "方形 LOGO",
      result: { b64_json: "data:image/jpeg;base64,AQIDBA==" },
      picturesDir
    });

    assert.equal(result.savedPath, path.join(picturesDir, "方形 LOGO.jpg"));
    assert.deepEqual(await readFile(result.savedPath), Buffer.from([1, 2, 3, 4]));
  } finally {
    await rm(picturesDir, { recursive: true, force: true });
  }
});

test("saveGeneratedImage appends sequence when prompt-named file already exists", async () => {
  const picturesDir = await mkdtemp(path.join(tmpdir(), "image-mcp-"));
  await writeFile(path.join(picturesDir, "重复名称.png"), Buffer.from([9]));

  try {
    const result = await saveGeneratedImage({
      prompt: "重复名称",
      result: { b64_json: "data:image/png;base64,AQID" },
      picturesDir
    });

    assert.equal(result.savedPath, path.join(picturesDir, "重复名称-2.png"));
  } finally {
    await rm(picturesDir, { recursive: true, force: true });
  }
});

test("saveGeneratedImage falls back when sanitized prompt is empty", async () => {
  const picturesDir = await mkdtemp(path.join(tmpdir(), "image-mcp-"));

  try {
    const result = await saveGeneratedImage({
      prompt: '"""',
      result: { b64_json: "data:image/png;base64,AQID" },
      picturesDir,
      now: () => new Date("2026-07-08T01:02:03.000Z")
    });

    assert.equal(result.savedPath, path.join(picturesDir, "apiyi-image-2026-07-08T01-02-03-000Z.png"));
  } finally {
    await rm(picturesDir, { recursive: true, force: true });
  }
});
