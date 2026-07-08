import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GenerateImageResult } from "./apiyi.js";

const MAX_FILENAME_LENGTH = 80;

/**
 * 已保存图片结果，包含 APIYi 返回内容和本地保存路径。
 */
export interface SavedGeneratedImageResult extends GenerateImageResult {
  /**
   * 图片在当前系统用户 Pictures 目录中的本地保存路径。
   */
  savedPath: string;
}

/**
 * 保存生成图片时使用的选项。
 */
export interface SaveGeneratedImageOptions {
  /**
   * 用户输入的原始提示词，用于生成本地文件名。
   */
  prompt: string;

  /**
   * APIYi 图片生成接口返回的标准化结果。
   */
  result: GenerateImageResult;

  /**
   * 图片保存目录；默认使用当前系统用户的 Pictures 目录。
   */
  picturesDir?: string;

  /**
   * 可注入的 fetch 实现，用于测试 URL 下载逻辑。
   */
  fetchImpl?: typeof fetch;

  /**
   * 可注入的当前时间函数，用于测试兜底文件名。
   */
  now?: () => Date;
}

/**
 * 将生成图片保存到当前系统用户的 Pictures 目录，并返回带 savedPath 的结果。
 */
export async function saveGeneratedImage(options: SaveGeneratedImageOptions): Promise<SavedGeneratedImageResult> {
  const picturesDir = options.picturesDir ?? getDefaultPicturesDir();
  const now = options.now ?? (() => new Date());
  const image = await readImageBytes(options.result, options.fetchImpl ?? fetch);
  const baseName = sanitizePromptForFilename(options.prompt) || createFallbackBaseName(now());
  const extension = image.extension;
  const savedPath = await createUniqueImagePath(picturesDir, baseName, extension);

  await mkdir(picturesDir, { recursive: true });
  await writeFile(savedPath, image.bytes);

  return {
    ...options.result,
    savedPath
  };
}

/**
 * 将提示词清理为可用于 Windows 文件名的安全文本。
 */
export function sanitizePromptForFilename(prompt: string): string {
  return prompt
    .replace(/[<>:"/\\|?*\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FILENAME_LENGTH)
    .trim();
}

/**
 * 获取当前系统用户的默认图片目录。
 */
function getDefaultPicturesDir(): string {
  return path.join(os.homedir(), "Pictures");
}

/**
 * 根据 APIYi 结果读取图片字节和文件扩展名。
 */
async function readImageBytes(result: GenerateImageResult, fetchImpl: typeof fetch): Promise<{ bytes: Buffer; extension: string }> {
  if (typeof result.b64_json === "string") {
    return decodeDataUrlImage(result.b64_json);
  }

  if (typeof result.url === "string") {
    return downloadUrlImage(result.url, fetchImpl);
  }

  throw new Error("Generated image result did not include url or b64_json");
}

/**
 * 下载 URL 图片并返回图片字节和文件扩展名。
 */
async function downloadUrlImage(url: string, fetchImpl: typeof fetch): Promise<{ bytes: Buffer; extension: string }> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type");

  return {
    bytes: Buffer.from(arrayBuffer),
    extension: getImageExtensionFromContentType(contentType) ?? getImageExtensionFromUrl(url)
  };
}

/**
 * 解码 base64 data URL 图片并返回图片字节和文件扩展名。
 */
function decodeDataUrlImage(dataUrl: string): { bytes: Buffer; extension: string } {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);

  if (match === null) {
    throw new Error("b64_json was not a valid base64 data URL");
  }

  return {
    bytes: Buffer.from(match[2], "base64"),
    extension: getImageExtensionFromContentType(match[1]) ?? ".png"
  };
}

/**
 * 根据内容类型推断图片扩展名。
 */
function getImageExtensionFromContentType(contentType: string | null): string | undefined {
  const normalizedContentType = contentType?.split(";")[0]?.trim().toLowerCase();

  switch (normalizedContentType) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return undefined;
  }
}

/**
 * 根据图片 URL 路径推断扩展名，无法识别时默认使用 png。
 */
function getImageExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const extension = path.extname(pathname).toLowerCase();

    if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) {
      return extension === ".jpeg" ? ".jpg" : extension;
    }
  } catch {
    return ".png";
  }

  return ".png";
}

/**
 * 创建不覆盖已有文件的图片保存路径。
 */
async function createUniqueImagePath(directory: string, baseName: string, extension: string): Promise<string> {
  let index = 1;

  while (true) {
    const suffix = index === 1 ? "" : `-${index}`;
    const candidate = path.join(directory, `${baseName}${suffix}${extension}`);

    if (!(await pathExists(candidate))) {
      return candidate;
    }

    index += 1;
  }
}

/**
 * 判断路径是否已经存在。
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 根据当前时间生成提示词不可用时的兜底文件名。
 */
function createFallbackBaseName(now: Date): string {
  return `apiyi-image-${now.toISOString().replace(/[:.]/g, "-")}`;
}
