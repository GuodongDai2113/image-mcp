# Changelog

本项目的所有重要变更都记录在此文件中。版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## 未发布

### 变更

- 文生图模型升级为 `gpt-image-2.6-flare`，图片编辑模型升级为 `gpt-image-2.6-sunburst`。
- 按 GPT-Image 2.6 官转接口规范移除 `response_format` 参数，并兼容其纯 Base64 图片响应。
- 默认图片优先保存到 Agent 当前工作目录的 `.agents/images`，不存在 `.agents` 时保存到 `images`。

## [1.0.0] - 2026-08-24

### 新增

- 提供 `generate_image` 文生图工具。
- 提供 `edit_image` 本地参考图编辑工具。
- 提供 `article_cover` 文章封面工具。
- 提供 `article_illustration` 文章内配图工具。
- 支持 `url` 与 `b64_json` 响应格式。
- 自动将生成图片保存到用户的 `Pictures` 目录。
- 支持文章工具按产品图、Logo 的顺序上传可选参考图片。
