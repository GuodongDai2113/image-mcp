#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { editImage, generateImage, type GenerateImageResult, type ResponseFormat } from "./apiyi.js";
import { buildArticleCoverPrompt, buildArticleIllustrationPrompt } from "./articlePrompts.js";
import { saveGeneratedImage } from "./imageFile.js";

/**
 * MCP 客户端调用文生图能力时使用的工具名称。
 */
export const GENERATE_IMAGE_TOOL_NAME = "generate_image";

/**
 * MCP 客户端调用图片上传编辑能力时使用的工具名称。
 */
export const EDIT_IMAGE_TOOL_NAME = "edit_image";

/**
 * MCP 客户端调用文章封面生成能力时使用的工具名称。
 */
export const ARTICLE_COVER_TOOL_NAME = "article_cover";

/**
 * MCP 客户端调用文章内配图生成能力时使用的工具名称。
 */
export const ARTICLE_ILLUSTRATION_TOOL_NAME = "article_illustration";

/**
 * 创建并配置 image-mcp 的 MCP 服务实例。
 */
export function createImageMcpServer(): McpServer {
  const server = new McpServer({
    name: "image-mcp",
    version: "1.0.0"
  });

  server.registerTool(
    GENERATE_IMAGE_TOOL_NAME,
    {
      title: "Generate Image",
      description: "Generate one image from a text prompt using APIYi gpt-image-2-all.",
      inputSchema: {
        prompt: z.string().min(1).describe("Image generation prompt. Include size, aspect ratio, and style requirements in the prompt."),
        response_format: z.enum(["url", "b64_json"]).optional().describe("Image response format. Defaults to url.")
      }
    },
    async ({ prompt, response_format }) => {
      try {
        const result = await generateImage({
          prompt,
          responseFormat: response_format as ResponseFormat | undefined
        });
        const savedResult = await saveGeneratedImage({
          prompt,
          result
        });

        return {
          content: [
            {
              type: "text",
              text: formatToolResult(savedResult)
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage(error)
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    EDIT_IMAGE_TOOL_NAME,
    {
      title: "Edit Image",
      description: "Upload one local image and generate a new image from a prompt using APIYi gpt-image-2-all.",
      inputSchema: {
        prompt: z.string().min(1).describe("Image editing prompt describing how to generate a new image from the uploaded image."),
        image_path: z.string().min(1).describe("Local image path to upload to APIYi."),
        response_format: z.enum(["url", "b64_json"]).optional().describe("Image response format. Defaults to url.")
      }
    },
    async ({ prompt, image_path, response_format }) => {
      try {
        const result = await editImage({
          prompt,
          imagePath: image_path,
          responseFormat: response_format as ResponseFormat | undefined
        });
        const savedResult = await saveGeneratedImage({
          prompt,
          result
        });

        return {
          content: [
            {
              type: "text",
              text: formatToolResult(savedResult)
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage(error)
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    ARTICLE_COVER_TOOL_NAME,
    {
      title: "Article Cover",
      description: "Create a 16:9 article cover with optional product and logo images.",
      inputSchema: {
        title: z.string().min(1).describe("Article title used for the cover theme and saved filename."),
        product_image_path: z.string().trim().min(1).optional().describe("Optional local product image path. The product is preserved as the main visual subject when provided."),
        logo_image_path: z.string().trim().min(1).optional().describe("Optional local logo image path. The logo is preserved and placed as a subtle brand mark."),
        summary: z.string().optional().describe("Article summary, audience, or background context."),
        response_format: z.enum(["url", "b64_json"]).optional().describe("Image response format. Defaults to url.")
      }
    },
    async ({ title, product_image_path, logo_image_path, summary, response_format }) => {
      try {
        const usesProductImage = product_image_path !== undefined;
        const usesLogoImage = logo_image_path !== undefined;
        const prompt = buildArticleCoverPrompt({
          title,
          summary,
          usesProductImage,
          usesLogoImage
        });
        const result = await generateArticleImage({
          prompt,
          productImagePath: product_image_path,
          logoImagePath: logo_image_path,
          responseFormat: response_format as ResponseFormat | undefined
        });
        const savedResult = await saveGeneratedImage({
          prompt: title,
          result
        });

        return {
          content: [
            {
              type: "text",
              text: formatToolResult(savedResult)
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage(error)
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    ARTICLE_ILLUSTRATION_TOOL_NAME,
    {
      title: "Article Illustration",
      description: "Create a 16:9 in-article illustration with optional product and logo images.",
      inputSchema: {
        topic: z.string().min(1).describe("Article illustration topic used for image content and the saved filename."),
        section_context: z.string().optional().describe("Article section context used to align the illustration with the body text."),
        product_image_path: z.string().trim().min(1).optional().describe("Optional local product image path. The product is preserved as the main visual subject when provided."),
        logo_image_path: z.string().trim().min(1).optional().describe("Optional local logo image path. The logo is preserved and placed as a subtle brand mark."),
        response_format: z.enum(["url", "b64_json"]).optional().describe("Image response format. Defaults to url.")
      }
    },
    async ({ topic, section_context, product_image_path, logo_image_path, response_format }) => {
      try {
        const usesProductImage = product_image_path !== undefined;
        const usesLogoImage = logo_image_path !== undefined;
        const prompt = buildArticleIllustrationPrompt({
          topic,
          sectionContext: section_context,
          usesProductImage,
          usesLogoImage
        });
        const result = await generateArticleImage({
          prompt,
          productImagePath: product_image_path,
          logoImagePath: logo_image_path,
          responseFormat: response_format as ResponseFormat | undefined
        });
        const savedResult = await saveGeneratedImage({
          prompt: topic,
          result
        });

        return {
          content: [
            {
              type: "text",
              text: formatToolResult(savedResult)
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: getErrorMessage(error)
            }
          ]
        };
      }
    }
  );

  return server;
}

/**
 * 将图片生成结果格式化为 MCP 文本内容中的可读 JSON。
 */
export function formatToolResult(result: GenerateImageResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * 使用固定文章提示词和可选参考图生成图片；无参考图时调用文生图，有参考图时按产品图、Logo 的顺序调用图片编辑。
 */
async function generateArticleImage(options: {
  /**
   * 已由文章工具构建完成的固定提示词。
   */
  prompt: string;

  /**
   * 可选产品图片路径；存在时始终作为第一张参考图。
   */
  productImagePath?: string;

  /**
   * 可选 Logo 图片路径；存在产品图时作为第二张参考图，否则作为第一张参考图。
   */
  logoImagePath?: string;

  /**
   * APIYi 返回图片时使用的响应格式。
   */
  responseFormat?: ResponseFormat;
}): Promise<GenerateImageResult> {
  const imagePaths: string[] = [];

  if (options.productImagePath !== undefined) {
    imagePaths.push(options.productImagePath);
  }

  if (options.logoImagePath !== undefined) {
    imagePaths.push(options.logoImagePath);
  }

  if (imagePaths.length === 0) {
    return generateImage({
      prompt: options.prompt,
      responseFormat: options.responseFormat
    });
  }

  return editImage({
    prompt: options.prompt,
    imagePath: imagePaths[0],
    additionalImagePaths: imagePaths.length > 1 ? imagePaths.slice(1) : undefined,
    responseFormat: options.responseFormat
  });
}

/**
 * 启动基于标准输入输出的 MCP 服务。
 */
export async function runStdioServer(): Promise<void> {
  const server = createImageMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

/**
 * 判断当前模块是否是通过 Node.js 命令行直接执行。
 */
function isDirectRun(): boolean {
  const entryPoint = process.argv[1];

  return entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href;
}

/**
 * 将未知错误转换为适合 MCP 客户端展示的错误消息。
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (isDirectRun()) {
  runStdioServer().catch((error: unknown) => {
    console.error(getErrorMessage(error));
    process.exit(1);
  });
}
