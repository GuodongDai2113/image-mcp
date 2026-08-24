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

  /**
   * 是否会随请求上传产品图片；为 true 时提示词会要求保留上传产品图主体。
   */
  usesProductImage: boolean;

  /**
   * 是否会随请求上传 Logo 图片；为 true 时提示词会要求原样保留品牌标识。
   */
  usesLogoImage: boolean;
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

  /**
   * 是否会随请求上传 Logo 图片；为 true 时提示词会要求将其作为克制的品牌署名。
   */
  usesLogoImage: boolean;
}

/**
 * 根据 Git 中的原始规则构建 16:9 文章封面提示词，并在上传 Logo 时追加品牌要求。
 */
export function buildArticleCoverPrompt(options: ArticleCoverPromptOptions): string {
  const summaryLine = options.summary?.trim()
    ? `Article summary or audience context: ${options.summary.trim()}`
    : "Article summary or audience context: not provided.";
  const imageInstruction = options.usesProductImage
    ? "Use the uploaded product image as the main visual subject, preserving product recognizability and key details."
    : "Create the cover from text only, with a relevant product or application scenario implied by the article title.";
  const logoInstruction = options.usesLogoImage
    ? `Image ${options.usesProductImage ? 2 : 1} is the uploaded Logo. Add the Logo to the cover while preserving its original appearance, proportions, and colors. Use the Logo's dominant color as the cover's primary color palette.`
    : undefined;

  return [
    `Create a 16:9 article cover image. ${imageInstruction} Design for a technical blog or company article. Use the application scenario as background.`,
    `Article title: ${options.title.trim()}`,
    summaryLine,
    ...(logoInstruction === undefined ? [] : [logoInstruction])
  ].join("\n");
}

/**
 * 根据 Git 中的原始规则构建 16:9 文章内配图提示词，并在上传 Logo 时追加品牌要求。
 */
export function buildArticleIllustrationPrompt(options: ArticleIllustrationPromptOptions): string {
  const contextLine = options.sectionContext?.trim()
    ? `Section context: ${options.sectionContext.trim()}`
    : "Section context: not provided.";
  const logoInstruction = options.usesLogoImage
    ? "Image 1 is the uploaded Logo. Add the Logo to the illustration while preserving its original appearance, proportions, and colors. Use the Logo's dominant color as the illustration's primary color palette."
    : undefined;

  return [
    "Create a 16:9 illustration. ",
    `Illustration topic: ${options.topic.trim()}`,
    contextLine,
    ...(logoInstruction === undefined ? [] : [logoInstruction])
  ].join("\n");
}
