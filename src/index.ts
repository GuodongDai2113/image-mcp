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
      description: "Create a 16:9 article cover from a required product image and built-in prompt.",
      inputSchema: {
        title: z.string().min(1).describe("Article title used for the cover theme and saved filename."),
        product_image_path: z.string().min(1).describe("Required local product image path to upload."),
        summary: z.string().optional().describe("Article summary, audience, or background context."),
        response_format: z.enum(["url", "b64_json"]).optional().describe("Image response format. Defaults to url.")
      }
    },
    async ({ title, product_image_path, summary, response_format }) => {
      try {
        const prompt = buildArticleCoverPrompt({
          title,
          summary
        });
        const result = await editImage({
          prompt,
          imagePath: product_image_path,
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
      description: "Create a 16:9 in-article illustration using text-to-image and a built-in prompt.",
      inputSchema: {
        topic: z.string().min(1).describe("Article illustration topic used for image content and the saved filename."),
        section_context: z.string().optional().describe("Article section context used to align the illustration with the body text."),
        response_format: z.enum(["url", "b64_json"]).optional().describe("Image response format. Defaults to url.")
      }
    },
    async ({ topic, section_context, response_format }) => {
      try {
        const prompt = buildArticleIllustrationPrompt({
          topic,
          sectionContext: section_context
        });
        const result = await generateImage({
          prompt,
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
