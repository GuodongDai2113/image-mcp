import { readFile } from "node:fs/promises";
import path from "node:path";

const APIYI_IMAGE_GENERATION_URL = "https://api.apiyi.com/v1/images/generations";
const APIYI_IMAGE_EDIT_URL = "https://api.apiyi.com/v1/images/edits";
const APIYI_IMAGE_MODEL = "gpt-image-2-all";

/**
 * APIYi 图片生成接口支持的响应格式。
 */
export type ResponseFormat = "url" | "b64_json";

/**
 * 调用 APIYi 文生图接口时使用的选项。
 */
export interface GenerateImageOptions {
  /**
   * 用户输入的图片生成提示词，尺寸、比例和风格也应写在这里。
   */
  prompt: string;

  /**
   * 图片响应格式；默认使用 url，避免 MCP 返回体过大。
   */
  responseFormat?: ResponseFormat;

  /**
   * APIYi API Key；未传入时会读取环境变量 APIYI_API_KEY。
   */
  apiKey?: string;

  /**
   * 可注入的 fetch 实现，主要用于单元测试中避免真实网络请求。
   */
  fetchImpl?: typeof fetch;
}

/**
 * 调用 APIYi 图片上传编辑接口时使用的选项。
 */
export interface EditImageOptions {
  /**
   * 用户输入的图片编辑提示词，描述希望如何基于上传图片生成新图片。
   */
  prompt: string;

  /**
   * 需要上传给 APIYi 的本地图片路径。
   */
  imagePath: string;

  /**
   * 图片响应格式；默认使用 url，避免 MCP 返回体过大。
   */
  responseFormat?: ResponseFormat;

  /**
   * APIYi API Key；未传入时会读取环境变量 APIYI_API_KEY。
   */
  apiKey?: string;

  /**
   * 可注入的 fetch 实现，主要用于单元测试中避免真实网络请求。
   */
  fetchImpl?: typeof fetch;
}

/**
 * APIYi 图片生成接口返回给 MCP 工具的标准化结果。
 */
export interface GenerateImageResult {
  /**
   * APIYi 返回的 Unix 秒级创建时间戳。
   */
  created?: number;

  /**
   * APIYi 返回的 token 用量统计。
   */
  usage?: unknown;

  /**
   * response_format 为 url 时返回的图片链接。
   */
  url?: string;

  /**
   * response_format 为 b64_json 时返回的 base64 data URL。
   */
  b64_json?: string;
}

interface ApiyiResponseBody {
  /**
   * APIYi 返回的图片结果数组；当前模型单次通常只返回一张图片。
   */
  data?: Array<{
    /**
     * response_format 为 url 时返回的图片链接。
     */
    url?: unknown;

    /**
     * response_format 为 b64_json 时返回的 base64 data URL。
     */
    b64_json?: unknown;
  }>;

  /**
   * APIYi 返回的 Unix 秒级创建时间戳。
   */
  created?: unknown;

  /**
   * APIYi 返回的 token 用量统计。
   */
  usage?: unknown;

  /**
   * APIYi 返回的错误信息，可能是字符串或包含 message 的对象。
   */
  error?: unknown;
}

/**
 * 根据提示词调用 APIYi gpt-image-2-all 文生图接口，并返回标准化图片结果。
 */
export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const responseFormat = options.responseFormat ?? "url";
  const apiKey = resolveApiKey(options.apiKey);
  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(APIYI_IMAGE_GENERATION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: APIYI_IMAGE_MODEL,
      prompt: options.prompt,
      response_format: responseFormat
    })
  });

  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(`APIYi request failed with status ${response.status}: ${summarizeApiError(body)}`);
  }

  return normalizeImageResult(body, responseFormat);
}

/**
 * 上传本地图片并根据提示词调用 APIYi gpt-image-2-all 图片编辑接口。
 */
export async function editImage(options: EditImageOptions): Promise<GenerateImageResult> {
  const responseFormat = options.responseFormat ?? "url";
  const apiKey = resolveApiKey(options.apiKey);
  const fetchImpl = options.fetchImpl ?? fetch;
  const formData = await createEditImageFormData(options.imagePath, options.prompt, responseFormat);

  const response = await fetchImpl(APIYI_IMAGE_EDIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new Error(`APIYi request failed with status ${response.status}: ${summarizeApiError(body)}`);
  }

  return normalizeImageResult(body, responseFormat);
}

/**
 * 创建 APIYi 图片编辑接口需要的 multipart/form-data 请求体。
 */
async function createEditImageFormData(imagePath: string, prompt: string, responseFormat: ResponseFormat): Promise<FormData> {
  const imageBuffer = await readImageFile(imagePath);
  const filename = path.basename(imagePath);
  const imageBytes = new Uint8Array(imageBuffer);
  const imageBlob = new Blob([imageBytes], {
    type: getMimeTypeFromPath(imagePath)
  });
  const formData = new FormData();

  formData.append("model", APIYI_IMAGE_MODEL);
  formData.append("prompt", prompt);
  formData.append("response_format", responseFormat);
  formData.append("image", imageBlob, filename);

  return formData;
}

/**
 * 读取本地图片文件，读取失败时返回面向工具调用者的清晰错误。
 */
async function readImageFile(imagePath: string): Promise<Buffer> {
  try {
    return await readFile(imagePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Image file could not be read: ${message}`);
  }
}

/**
 * 根据本地图片路径推断上传时使用的 MIME 类型。
 */
function getMimeTypeFromPath(imagePath: string): string {
  switch (path.extname(imagePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".png":
    default:
      return "image/png";
  }
}

/**
 * 从显式参数或环境变量中解析 APIYi API Key。
 */
function resolveApiKey(apiKey: string | undefined): string {
  const resolvedApiKey = apiKey ?? process.env.APIYI_API_KEY ?? "";

  if (resolvedApiKey.trim().length === 0) {
    throw new Error("APIYI_API_KEY is required");
  }

  return resolvedApiKey;
}

/**
 * 将 API 响应体解析为 JSON 对象；解析失败时返回空对象用于后续错误处理。
 */
async function parseJsonBody(response: Response): Promise<ApiyiResponseBody> {
  try {
    return (await response.json()) as ApiyiResponseBody;
  } catch {
    return {};
  }
}

/**
 * 将 APIYi 的原始响应转换为 MCP 工具使用的稳定结果结构。
 */
function normalizeImageResult(body: ApiyiResponseBody, responseFormat: ResponseFormat): GenerateImageResult {
  const firstImage = body.data?.[0];

  if (responseFormat === "url") {
    if (typeof firstImage?.url !== "string") {
      throw new Error("APIYi response did not include url");
    }

    return removeUndefinedProperties({
      created: typeof body.created === "number" ? body.created : undefined,
      usage: body.usage,
      url: firstImage.url
    });
  }

  if (typeof firstImage?.b64_json !== "string") {
    throw new Error("APIYi response did not include b64_json");
  }

  return removeUndefinedProperties({
    created: typeof body.created === "number" ? body.created : undefined,
    usage: body.usage,
    b64_json: firstImage.b64_json
  });
}

/**
 * 从 APIYi 错误响应中提取适合展示的简短错误摘要。
 */
function summarizeApiError(body: ApiyiResponseBody): string {
  if (isRecord(body.error) && typeof body.error.message === "string") {
    return body.error.message;
  }

  if (typeof body.error === "string") {
    return body.error;
  }

  return "unknown error";
}

/**
 * 判断未知值是否为可安全读取属性的普通对象。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 删除结果对象中的 undefined 属性，让 JSON 结构和断言保持一致。
 */
function removeUndefinedProperties(result: GenerateImageResult): GenerateImageResult {
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined)) as GenerateImageResult;
}
