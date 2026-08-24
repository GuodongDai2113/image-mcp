# image-mcp

基于 [Model Context Protocol（MCP）](https://modelcontextprotocol.io/) 的图片生成服务。项目通过 APIYi 的 `gpt-image-2-all` 模型提供文生图、参考图编辑、文章封面和文章内配图能力，并将生成结果自动保存到当前用户的 `Pictures` 目录。

## 功能

- 根据文字提示词生成图片
- 根据一张本地参考图编辑或重新生成图片
- 生成 16:9 文章封面，可选产品图和 Logo
- 生成 16:9 文章内配图，可选产品图和 Logo
- 支持 URL 和 Base64 两种 API 响应格式
- 自动下载并保存图片，不覆盖已有的同名文件
- 使用 stdio 与 OpenCode、Claude Desktop 等 MCP 客户端通信

## 环境要求

- Node.js 18 或更高版本（建议使用 Node.js 20 或更高版本）
- npm
- 有效的 APIYi API Key

## 安装与构建

### 从源码构建

```bash
git clone https://github.com/GuodongDai2113/image-mcp.git
cd image-mcp
npm install
npm run build
```

构建产物位于 `build/`，MCP 服务入口为 `build/index.js`。

## 配置 API Key

服务从 `APIYI_API_KEY` 环境变量读取 APIYi API Key。

PowerShell：

```powershell
$env:APIYI_API_KEY = "你的 API Key"
```

Windows CMD：

```cmd
set APIYI_API_KEY=你的 API Key
```

Linux 或 macOS：

```bash
export APIYI_API_KEY="你的 API Key"
```

也可以直接在 MCP 客户端的服务配置中传入该环境变量。

## MCP 客户端配置

请将示例中的路径替换为本项目在本机的绝对路径。Windows JSON 路径中的反斜杠需要写成 `\\`，也可以使用正斜杠。

### OpenCode

在 `opencode.jsonc` 中添加：

```jsonc
{
  "mcp": {
    "image-mcp": {
      "type": "local",
      "command": [
        "node",
        "S:/mcps/image-mcp/build/index.js"
      ],
      "environment": {
        "APIYI_API_KEY": "{env:APIYI_API_KEY}"
      },
      "enabled": true
    }
  }
}
```

### 通用 MCP 配置

适用于使用 `mcpServers` 配置格式的客户端：

```json
{
  "mcpServers": {
    "image-mcp": {
      "command": "node",
      "args": ["S:/mcps/image-mcp/build/index.js"],
      "env": {
        "APIYI_API_KEY": "你的 API Key"
      }
    }
  }
}
```

已发布 npm 包也可以使用以下配置，无需填写本地项目路径：

```json
{
  "mcpServers": {
    "image-mcp": {
      "command": "npx",
      "args": ["-y", "@guodongdai2113/image-mcp"],
      "env": {
        "APIYI_API_KEY": "你的 API Key"
      }
    }
  }
}
```

建议优先让客户端继承系统环境变量，避免将 API Key 提交到版本控制中。修改代码后需要重新运行 `npm run build`，然后重启或重新连接 MCP 服务。

## 可用工具

### `generate_image`

根据文字提示词生成一张图片。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `prompt` | string | 是 | 图片生成提示词；尺寸、比例和风格要求应一并写入提示词 |
| `response_format` | `url` \| `b64_json` | 否 | API 响应格式，默认值为 `url` |

调用示例：

```json
{
  "prompt": "生成一张 16:9 的未来城市夜景，蓝紫色霓虹灯，电影感构图",
  "response_format": "url"
}
```

### `edit_image`

上传一张本地图片，并根据提示词生成一张新图片。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `prompt` | string | 是 | 描述需要如何基于参考图生成新图片 |
| `image_path` | string | 是 | MCP 服务进程可访问的本地图片路径 |
| `response_format` | `url` \| `b64_json` | 否 | API 响应格式，默认值为 `url` |

调用示例：

```json
{
  "prompt": "保留主体，将背景替换为日落时的海边，使用柔和暖色调",
  "image_path": "C:/Users/Administrator/Pictures/product.png"
}
```

### `article_cover`

生成一张 16:9 的文章封面。提供产品图时，产品会作为主要视觉主体；提供 Logo 时，会保留其外观、比例和颜色，并参考 Logo 主色构建画面配色。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 文章标题，同时用于生成本地文件名 |
| `summary` | string | 否 | 文章摘要、目标读者或背景信息 |
| `product_image_path` | string | 否 | 本地产品图片路径 |
| `logo_image_path` | string | 否 | 本地 Logo 图片路径 |
| `response_format` | `url` \| `b64_json` | 否 | API 响应格式，默认值为 `url` |

调用示例：

```json
{
  "title": "边缘计算如何重塑智能制造",
  "summary": "面向制造业技术负责人的趋势分析",
  "product_image_path": "C:/assets/device.png",
  "logo_image_path": "C:/assets/logo.png"
}
```

### `article_illustration`

生成一张 16:9 的文章内配图，使画面内容与指定小节保持一致。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `topic` | string | 是 | 配图主题，同时用于生成本地文件名 |
| `section_context` | string | 否 | 文章小节内容或上下文 |
| `product_image_path` | string | 否 | 本地产品图片路径 |
| `logo_image_path` | string | 否 | 本地 Logo 图片路径 |
| `response_format` | `url` \| `b64_json` | 否 | API 响应格式，默认值为 `url` |

调用示例：

```json
{
  "topic": "工厂设备的实时数据采集",
  "section_context": "本节介绍边缘网关如何降低数据传输延迟并保障生产连续性。"
}
```

## 返回结果与图片保存

每次工具调用成功后都会返回格式化的 JSON 文本。使用默认的 `url` 格式时，结果类似：

```json
{
  "created": 1787539200,
  "usage": {},
  "url": "https://example.com/generated-image.png",
  "savedPath": "C:\\Users\\Administrator\\Pictures\\未来城市夜景.png"
}
```

图片默认保存在：

- Windows：`C:\\Users\\<用户名>\\Pictures`
- Linux/macOS：`~/Pictures`

文件名来自提示词、文章标题或配图主题。名称中的非法字符会被移除，最长保留 80 个字符；如果同名文件已经存在，服务会自动添加 `-2`、`-3` 等后缀。

> `b64_json` 仅表示 APIYi 返回图片数据的格式。MCP 服务仍会把图片解码并保存到本地，同时在结果中返回 `savedPath`。

## 开发命令

```bash
# 编译 TypeScript
npm run build

# 编译并运行全部测试
npm test

# 直接运行已经编译的测试
npm run test:unit

# 执行测试并检查 npm 发布包内容
npm run check

# 启动 MCP stdio 服务
node build/index.js
```

## 发布流程

发布前请确认拥有 npm 作用域 `@guodongdai2113` 的发布权限，并已经通过 `npm login` 登录：

```bash
# 1. 完成全部自动检查
npm run check

# 2. 按语义化版本规则更新版本号，例如补丁版本
npm version patch

# 3. 推送提交和版本标签
git push --follow-tags

# 4. 发布公开包
npm publish
```

`prepublishOnly` 会在发布前再次运行全部测试。发布内容由 `package.json` 的 `files` 白名单控制，不会包含源码、测试、密钥或本地配置。

注意：stdio 模式需要由 MCP 客户端通过标准输入输出与服务通信，通常不建议在普通终端中手动交互。

## 常见问题

### 提示 `APIYI_API_KEY is required`

当前 MCP 服务进程没有读取到 `APIYI_API_KEY`。请检查系统环境变量或客户端配置，并在修改配置后重启 MCP 服务。

### 提示 `Image file could not be read`

请确认图片路径为绝对路径、文件确实存在，并且启动 MCP 服务的用户拥有读取权限。路径指向的是运行服务的本机，而不是远程模型所在环境。

### 工具调用成功但图片没有保存

检查 `Pictures` 目录是否可写。如果使用 URL 响应格式，还需要确保服务可以访问 API 返回的图片地址。

### 修改源码后没有生效

客户端运行的是 `build/index.js`。修改 `src/` 后请执行 `npm run build`，再重启或重新连接客户端中的 MCP 服务。

## 项目结构

```text
src/
├── index.ts             # MCP 服务入口与工具注册
├── apiyi.ts             # APIYi 图片生成、编辑与响应处理
├── articlePrompts.ts    # 文章封面和文章配图提示词构建
├── imageFile.ts         # 图片下载、解码、命名与本地保存
└── *.test.ts            # 单元测试
```

## 安全提示

- 不要将 API Key 写入源码或提交到 Git。
- 图片编辑工具会将指定的本地图片上传到 APIYi，请勿传入敏感图片。
- API 返回的图片 URL 可能具有时效性，请以本地 `savedPath` 中保存的文件为准。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
