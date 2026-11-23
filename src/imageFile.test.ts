import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("saveGeneratedImage defaults to .agents/images when the .agents folder exists", async () => {
  const originalWorkingDirectory = process.cwd();
  const agentWorkingDirectory = await mkdtemp(path.join(tmpdir(), "image-mcp-workspace-"));

  try {
    // 模拟带有 Agent 配置目录的项目，验证图片优先集中保存到 .agents/images。
    await mkdir(path.join(agentWorkingDirectory, ".agents"));
    process.chdir(agentWorkingDirectory);

    const result = await saveGeneratedImage({
      prompt: "工作目录图片",
      result: { b64_json: "data:image/png;base64,AQID" }
    });

    assert.equal(result.savedPath, path.join(agentWorkingDirectory, ".agents", "images", "工作目录图片.png"));
  } finally {
    process.chdir(originalWorkingDirectory);
    await rm(agentWorkingDirectory, { recursive: true, force: true });
  }
});

test("saveGeneratedImage defaults to images when the .agents folder does not exist", async () => {
  const originalWorkingDirectory = process.cwd();
  const projectDirectory = await mkdtemp(path.join(tmpdir(), "image-mcp-project-"));

  try {
    // 模拟普通项目目录，验证未配置 .agents 时仍在项目内使用 images 目录。
    process.chdir(projectDirectory);

    const result = await saveGeneratedImage({
      prompt: "项目图片",
      result: { b64_json: "data:image/png;base64,AQID" }
    });

    assert.equal(result.savedPath, path.join(projectDirectory, "images", "项目图片.png"));
  } finally {
    process.chdir(originalWorkingDirectory);
    await rm(projectDirectory, { recursive: true, force: true });
  }
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
