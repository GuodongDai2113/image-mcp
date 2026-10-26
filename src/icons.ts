import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { generateImage, type GenerateImageOptions } from "./apiyi.js";
import { saveGeneratedImage, sanitizePromptForFilename } from "./imageFile.js";

/** 批量图标生成参数，数量必须与按顺序排列的描述完全一致。 */
export interface GenerateIconsOptions {
  /** 要生成的图标数量，限制为一至三十六个以保证单张网格图的可用性。 */
  count: number;
  /** 每个图标的内容描述，数组顺序即最终文件顺序。 */
  descriptions: string[];
  /** 所有图标共同使用的视觉风格。 */
  style?: string;
  /** API 响应格式，不改变最终图标的 PNG 格式。 */
  responseFormat?: GenerateImageOptions["responseFormat"];
  /** 可选保存根目录，默认使用当前用户的图片目录。 */
  picturesDir?: string;
  /** 可注入的生成函数，供测试隔离真实付费请求。 */
  generateImpl?: typeof generateImage;
  /** 可注入的下载函数，供测试隔离网络。 */
  fetchImpl?: typeof fetch;
}

/** 单个已裁切图标的信息，索引从一开始并与输入描述对应。 */
export interface SavedIcon {
  /** 图标在输入列表中的序号。 */
  index: number;
  /** 此图标对应的原始描述。 */
  description: string;
  /** 裁切后 PNG 文件的绝对路径。 */
  savedPath: string;
  /** 正方形图标的实际像素宽度。 */
  width: number;
  /** 正方形图标的实际像素高度。 */
  height: number;
}

/** 校验参数并构造方形网格提示词；多余单元格保持空白。 */
export function buildIconsPrompt(options: Pick<GenerateIconsOptions, "count" | "descriptions" | "style">): string {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 36) {
    throw new Error("count must be an integer between 1 and 36");
  }
  if (options.descriptions.length !== options.count || options.descriptions.some((text) => !text.trim())) {
    throw new Error("descriptions must contain exactly count non-empty icon descriptions");
  }
  const side = Math.ceil(Math.sqrt(options.count));
  return [
    `Generate one square icon sprite sheet with exactly ${options.count} icons.`,
    `Use an exact ${side} by ${side} uniform grid covering the entire canvas, with equal square cells.`,
    "No outer margin, no gutters, no grid lines, no borders, no labels, no numbers, no text.",
    "Center each icon in its own cell, keep all artwork inside the central 70% of the cell, and never cross cell boundaries.",
    "Output a PNG with a genuinely transparent background (alpha channel). All background pixels, padding and unused cells must have alpha 0. Do not draw a white or colored background, checkerboard pattern, background panel or shadow outside the icons.",
    "Keep consistent lighting, palette, stroke weight and visual scale throughout. Preserve smooth anti-aliased transparent edges around each icon.",
    `Shared style: ${options.style?.trim() || "clean, minimal flat icons"}.`,
    "Place icons in row-major order, left to right and then top to bottom:",
    ...options.descriptions.map((description, index) => `Row ${Math.floor(index / side) + 1}, column ${index % side + 1}: ${description.trim()}`),
    `Leave the remaining ${side * side - options.count} cells completely transparent. The layout and transparent-background instructions take priority over the shared style and individual icon descriptions.`
  ].join("\n");
}

/** 根据透明通道中 Alpha 大于八的主体边界进行水平及垂直居中，不缩放，平移时保留抗锯齿像素。 */
async function centerIcon(image: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(image).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let firstRow = height;
  let lastRow = -1;
  let firstColumn = width;
  let lastColumn = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + channels - 1] > 8) {
        firstRow = Math.min(firstRow, y);
        lastRow = y;
        firstColumn = Math.min(firstColumn, x);
        lastColumn = Math.max(lastColumn, x);
      }
    }
  }
  // 全透明或仅有极淡像素时保持原图，避免将噪点误判为主体。
  if (lastRow < firstRow) return image;
  const offsetY = Math.floor((height - (lastRow - firstRow + 1)) / 2) - firstRow;
  const offsetX = Math.floor((width - (lastColumn - firstColumn + 1)) / 2) - firstColumn;
  if (offsetX === 0 && offsetY === 0) return image;
  const centered = Buffer.alloc(data.length);
  const rowBytes = width * channels;
  const sourceLeft = Math.max(0, -offsetX);
  const sourceRight = Math.min(width, width - offsetX);
  // 逐行复制全部通道，避免重采样改变线宽、颜色和半透明边缘。
  for (let y = 0; y < height; y++) {
    const targetRow = y + offsetY;
    if (targetRow >= 0 && targetRow < height) {
      data.copy(centered, targetRow * rowBytes + (sourceLeft + offsetX) * channels,
        y * rowBytes + sourceLeft * channels, y * rowBytes + sourceRight * channels);
    }
  }
  return sharp(centered, { raw: { width, height, channels } }).png().toBuffer();
}

/** 按等分网格裁切为相同尺寸的正方形 PNG，跳过空白格，并根据透明边界将各图标水平及垂直居中。 */
export async function cropIconGrid(gridPath: string, descriptions: string[], outputDir: string): Promise<SavedIcon[]> {
  buildIconsPrompt({ count: descriptions.length, descriptions });
  const side = Math.ceil(Math.sqrt(descriptions.length));
  const source = await sharp(gridPath).rotate().toBuffer();
  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const size = Math.floor(Math.min(width, height) / side);
  if (size < 1) {
    throw new Error("Generated image is too small for the icon grid");
  }
  await mkdir(outputDir, { recursive: true });
  const icons: SavedIcon[] = [];
  for (const [index, description] of descriptions.entries()) {
    const column = index % side;
    const row = Math.floor(index / side);
    const left = Math.floor((column + 0.5) * width / side - size / 2);
    const top = Math.floor((row + 0.5) * height / side - size / 2);
    const filename = `${String(index + 1).padStart(2, "0")}-${sanitizePromptForFilename(description) || "icon"}.png`;
    const savedPath = path.join(outputDir, filename);
    const cropped = await sharp(source).extract({ left, top, width: size, height: size }).png().toBuffer();
    const centered = await centerIcon(cropped);
    await sharp(centered).png().toFile(savedPath);
    icons.push({ index: index + 1, description, savedPath, width: size, height: size });
  }
  return icons;
}

/** 仅生成一张网格图，保存到独立批次目录后裁切并返回所有图标及原图路径。 */
export async function generateIcons(options: GenerateIconsOptions) {
  const prompt = buildIconsPrompt(options);
  const result = await (options.generateImpl ?? generateImage)({ prompt, responseFormat: options.responseFormat });
  const root = path.resolve(options.picturesDir ?? path.join(os.homedir(), "Pictures"));
  await mkdir(root, { recursive: true });
  const outputDir = await mkdtemp(path.join(root, "icons-"));
  const grid = await saveGeneratedImage({ prompt: "grid", result, picturesDir: outputDir, fetchImpl: options.fetchImpl });
  const icons = await cropIconGrid(grid.savedPath, options.descriptions, outputDir);
  const side = Math.ceil(Math.sqrt(options.count));
  return { created: result.created, usage: result.usage, count: icons.length, rows: side, columns: side, gridPath: grid.savedPath, outputDir, icons };
}
