import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { editImage, generateImage } from "./apiyi.js";

test("generateImage defaults to url and sends APIYi request fields", async () => {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  // 模拟 APIYi 成功响应，并记录客户端发出的请求内容。
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ input, init });

    return new Response(
      JSON.stringify({
        created: 1778037331,
        usage: { total_tokens: 2104 },
        data: [{ url: "https://r2.example/image.png" }]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
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
  // 模拟返回 base64 data URL 的 APIYi 响应。
  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        data: [{ b64_json: "data:image/png;base64,abc" }]
      }),
      { status: 200 }
    );

  const result = await generateImage({
    prompt: "1024x1024 方形 LOGO，极简猫咪线条",
    responseFormat: "b64_json",
    apiKey: "sk-test",
    fetchImpl: fakeFetch
  });

  assert.deepEqual(result, { b64_json: "data:image/png;base64,abc" });
});

test("generateImage rejects missing API key", async () => {
  // 这个 fetch 不应被调用；测试只验证密钥缺失时的前置校验。
  const fakeFetch: typeof fetch = async () => new Response("{}");

  await assert.rejects(
    () => generateImage({ prompt: "test", apiKey: "", fetchImpl: fakeFetch }),
    /APIYI_API_KEY is required/
  );
});

test("generateImage reports non-2xx APIYi responses", async () => {
  // 模拟 APIYi 返回配额错误，验证错误消息会保留服务端摘要。
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 });

  await assert.rejects(
    () => generateImage({ prompt: "test", apiKey: "sk-test", fetchImpl: fakeFetch }),
    /APIYi request failed with status 429: quota exceeded/
  );
});

test("generateImage reports missing expected image field", async () => {
  // 模拟格式合法但缺少图片字段的响应，验证客户端会显式报错。
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({ data: [{}] }), { status: 200 });

  await assert.rejects(
    () => generateImage({ prompt: "test", apiKey: "sk-test", fetchImpl: fakeFetch }),
    /APIYi response did not include url/
  );
});

test("editImage sends multipart APIYi request with image file and prompt", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "image-mcp-edit-"));
  const imagePath = path.join(tempDir, "source.png");
  await writeFile(imagePath, Buffer.from([137, 80, 78, 71]));
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

  // 模拟 APIYi 图片编辑成功响应，并记录 multipart 请求体。
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ input, init });

    return new Response(
      JSON.stringify({
        created: 1778037331,
        usage: { total_tokens: 2104 },
        data: [{ url: "https://r2.example/edited.png" }]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  try {
    const result = await editImage({
      prompt: "把产品图改成白底电商主图",
      imagePath,
      apiKey: "sk-test",
      fetchImpl: fakeFetch
    });

    assert.equal(calls.length, 1);
    assert.equal(String(calls[0].input), "https://api.apiyi.com/v1/images/edits");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(calls[0].init?.headers, {
      Authorization: "Bearer sk-test"
    });

    const formData = calls[0].init?.body as FormData;
    assert.equal(formData.get("model"), "gpt-image-2-all");
    assert.equal(formData.get("prompt"), "把产品图改成白底电商主图");
    assert.equal(formData.get("response_format"), "url");

    const image = formData.get("image") as File;
    assert.equal(image.name, "source.png");
    assert.equal(image.type, "image/png");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from([137, 80, 78, 71]));
    assert.deepEqual(result, {
      created: 1778037331,
      usage: { total_tokens: 2104 },
      url: "https://r2.example/edited.png"
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("editImage supports b64_json responses", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "image-mcp-edit-"));
  const imagePath = path.join(tempDir, "source.jpg");
  await writeFile(imagePath, Buffer.from([1, 2, 3]));

  // 模拟 APIYi 返回 base64 图片内容。
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ data: [{ b64_json: "data:image/png;base64,AQID" }] }), { status: 200 });

  try {
    const result = await editImage({
      prompt: "换背景",
      imagePath,
      responseFormat: "b64_json",
      apiKey: "sk-test",
      fetchImpl: fakeFetch
    });

    assert.deepEqual(result, { b64_json: "data:image/png;base64,AQID" });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("editImage reports missing image file path", async () => {
  await assert.rejects(
    () =>
      editImage({
        prompt: "test",
        imagePath: path.join(tmpdir(), "missing-image-file.png"),
        apiKey: "sk-test",
        fetchImpl: async () => new Response("{}")
      }),
    /Image file could not be read/
  );
});
