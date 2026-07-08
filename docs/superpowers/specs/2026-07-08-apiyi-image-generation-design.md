# APIYi GPT-Image-2-All MCP Image Generation Design

## Goal

Build a TypeScript MCP server tool that accepts a text prompt and generates one image through APIYi's `gpt-image-2-all` text-to-image endpoint.

## External API

The tool calls:

`POST https://api.apiyi.com/v1/images/generations`

Request body:

```json
{
  "model": "gpt-image-2-all",
  "prompt": "<user prompt>",
  "response_format": "url"
}
```

`response_format` may be `url` or `b64_json`. It defaults to `url` to keep MCP responses compact. The API key is read from `APIYI_API_KEY` and sent as `Authorization: Bearer <key>`.

Unsupported APIYi parameters such as `size`, `n`, `quality`, and `aspect_ratio` are intentionally not exposed. Size and aspect ratio guidance should be written in the prompt, matching the APIYi documentation.

## MCP Tool

Tool name: `generate_image`

Inputs:

- `prompt`: required string. The image generation prompt.
- `response_format`: optional enum, `url` or `b64_json`, default `url`.

Output:

- On success, text content containing JSON with `created`, `usage`, `url` or `b64_json`.
- On missing API key, invalid API response, network error, or non-2xx APIYi response, the tool returns an MCP error result with a clear message.

## Code Structure

- `src/apiyi.ts`: request and response handling for APIYi.
- `src/index.ts`: MCP server setup and tool registration.
- `src/apiyi.test.ts`: unit tests for request construction, response parsing, and error handling.

## Error Handling

The API wrapper validates that `data[0].url` exists for `url` responses or `data[0].b64_json` exists for `b64_json` responses. Non-JSON or malformed API responses are reported as invalid responses. APIYi error bodies are summarized without exposing the API key.

## Testing

Use Node's built-in test runner. Tests inject a fake `fetch` implementation so no live API call is made.

Required coverage:

- Sends the fixed model, prompt, response format, content type, and bearer token.
- Defaults `response_format` to `url`.
- Parses `url` responses.
- Parses `b64_json` responses.
- Throws a clear error when `APIYI_API_KEY` is missing.
- Throws a clear error on non-2xx APIYi responses.
- Throws a clear error when the expected image field is missing.
