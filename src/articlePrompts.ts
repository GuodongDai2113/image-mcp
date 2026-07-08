/**
 * 构建文章封面内置提示词时使用的选项。
 */
export interface ArticleCoverPromptOptions {
  /**
   * 文章标题，用于确定封面主题和本地保存文件名。
   */
  title: string;

  /**
   * 文章摘要或受众背景，用于辅助封面风格和语义表达。
   */
  summary?: string;
}

/**
 * 构建文章内配图内置提示词时使用的选项。
 */
export interface ArticleIllustrationPromptOptions {
  /**
   * 文章配图主题，用于确定画面主体和本地保存文件名。
   */
  topic: string;

  /**
   * 文章小节上下文，用于让配图贴合正文段落。
   */
  sectionContext?: string;
}

/**
 * 根据文章标题和摘要构建 16:9 文章封面提示词，要求使用上传产品图作为视觉主体。
 */
export function buildArticleCoverPrompt(options: ArticleCoverPromptOptions): string {
  const summaryLine = options.summary?.trim()
    ? `Article summary or audience context: ${options.summary.trim()}`
    : "Article summary or audience context: not provided.";

  return [
    "Create a 16:9 article cover image. Use the uploaded product image as the main visual subject, preserving product recognizability and key details. Design for a technical blog, company article.Use the application scenario as background. ",
    `Article title: ${options.title.trim()}`,
    summaryLine
  ].join("\n");
}

/**
 * 根据文章主题和小节上下文构建 16:9 文章内配图提示词，使用纯文生图形式。
 */
export function buildArticleIllustrationPrompt(options: ArticleIllustrationPromptOptions): string {
  const contextLine = options.sectionContext?.trim()
    ? `Section context: ${options.sectionContext.trim()}`
    : "Section context: not provided.";

  return [
    "Create a 16:9 illustration. ",
    `Illustration topic: ${options.topic.trim()}`,
    contextLine
  ].join("\n");
}
