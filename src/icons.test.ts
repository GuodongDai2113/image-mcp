import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { buildIconsPrompt, cropIconGrid, generateIcons } from "./icons.js";

/** 验证各方向偏移的主体均会水平及垂直居中，且颜色、尺寸和半透明边缘保持不变。 */
test("centers alpha bounds on both axes without scaling", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "icon-center-test-"));
  try {
    for (const size of [20, 21]) {
      for (const originalTop of [2, 12]) {
        for (const originalLeft of [2, 12]) {
        const pixels = Buffer.alloc(size * size * 4);
        for (let y = originalTop; y < originalTop + 4; y++) {
          for (let x = originalLeft; x < originalLeft + 5; x++) {
            pixels.set([30, 100, 200, x === originalLeft ? 64 : 255], (y * size + x) * 4);
          }
        }
        // 极淡的远端噪点不应影响主体边界。
        pixels.set([10, 20, 30, 4], 0);
        // 保留位于主体上方的极淡抗锯齿像素。
        pixels.set([30, 100, 200, 6], ((originalTop - 1) * size + originalLeft + 1) * 4);
        const grid = path.join(root, "grid.png");
        await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toFile(grid);
        const [icon] = await cropIconGrid(grid, ["test"], root);
        const { data, info } = await sharp(icon.savedPath).raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.width, size);
        assert.equal(info.height, size);
        const expectedTop = Math.floor((size - 4) / 2);
        const expectedLeft = Math.floor((size - 5) / 2);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const pixel = data.subarray((y * size + x) * 4, (y * size + x + 1) * 4);
            if (y >= expectedTop && y < expectedTop + 4 && x >= expectedLeft && x < expectedLeft + 5) {
              assert.deepEqual([...pixel], [30, 100, 200, x === expectedLeft ? 64 : 255]);
            } else {
              assert.ok(pixel[3] <= 8);
            }
          }
        }
        assert.equal(data[((expectedTop - 1) * size + expectedLeft + 1) * 4 + 3], 6);
        }
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 验证全透明、极淡及不透明背景不会被错误移动或丢失。 */
test("leaves empty, faint and fully opaque icons unchanged", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "icon-alpha-test-"));
  try {
    for (const alpha of [0, 4, 255]) {
      const pixels = Buffer.alloc(16 * 16 * 4);
      for (let index = 0; index < 16 * 16; index++) {
        pixels.set([index % 256, 20, 40, alpha], index * 4);
      }
      const grid = path.join(root, "grid.png");
      await sharp(pixels, { raw: { width: 16, height: 16, channels: 4 } }).png().toFile(grid);
      const [icon] = await cropIconGrid(grid, ["test"], root);
      assert.deepEqual(await sharp(icon.savedPath).raw().toBuffer(), pixels);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 验证数量及空描述在调用付费接口前被拒绝。 */
test("rejects invalid icon inputs before generation", async () => {
  for (const count of [0, 37, 1.5]) {
    assert.throws(() => buildIconsPrompt({ count, descriptions: ["home"] }));
  }
  await assert.rejects(generateIcons({ count: 2, descriptions: ["home"], generateImpl: async () => {
    assert.fail("must not call API for invalid inputs");
  } }), /exactly count/);
  assert.throws(() => buildIconsPrompt({ count: 1, descriptions: [" "] }), /non-empty/);
});

/** 验证一次生成、网格顺序、空格跳过、透明通道和正方形输出。 */
test("generates once and crops ordered square PNG icons into unique batch directories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "icon-test-"));
  try {
    const bytes = await sharp(Buffer.from('<svg width="100" height="100"><path fill="red" d="M0 0h50v50H0z"/><path fill="green" d="M50 0h50v50H50z"/><path fill="blue" d="M0 50h50v50H0z"/></svg>')).png().toBuffer();
    let calls = 0;
    const options = {
      count: 3,
      descriptions: ["red", "green", "blue"],
      picturesDir: root,
      /** 返回内存网格图并记录生成调用次数。 */
      generateImpl: async ({ prompt }: { prompt: string }) => {
        calls++;
        assert.match(prompt, /2 by 2/);
        assert.match(prompt, /remaining 1 cells/);
        return { b64_json: `data:image/png;base64,${bytes.toString("base64")}` };
      }
    };
    const result = await generateIcons(options);
    assert.equal(calls, 1);
    assert.equal(result.count, 3);
    assert.equal((await readdir(result.outputDir)).length, 4);
    for (const [index, icon] of result.icons.entries()) {
      const meta = await sharp(icon.savedPath).metadata();
      assert.equal(meta.width, 50);
      assert.equal(meta.height, 50);
      assert.equal(meta.format, "png");
      assert.equal(meta.hasAlpha, true);
      const pixel = await sharp(icon.savedPath).extract({ left: 25, top: 25, width: 1, height: 1 }).raw().toBuffer();
      assert.deepEqual([...pixel], [[255, 0, 0, 255], [0, 128, 0, 255], [0, 0, 255, 255]][index]);
    }
    const second = await generateIcons(options);
    assert.notEqual(second.outputDir, result.outputDir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** 验证非整除尺寸和非方形原图也能输出相同尺寸的正方形。 */
test("handles uneven image dimensions and rejects corrupt images", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "icon-size-test-"));
  try {
    const grid = path.join(root, "grid.png");
    await sharp({ create: { width: 103, height: 99, channels: 4, background: "white" } }).png().toFile(grid);
    const icons = await cropIconGrid(grid, ["a", "b", "c"], root);
    for (const icon of icons) {
      const meta = await sharp(icon.savedPath).metadata();
      assert.equal(meta.width, 49);
      assert.equal(meta.height, 49);
    }
    await writeFile(grid, "invalid image");
    await assert.rejects(cropIconGrid(grid, ["a"], root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
