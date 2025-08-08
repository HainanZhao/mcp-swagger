# MCP Swagger Server

An MCP (Model Context Protocol) server that automatically converts REST APIs with Swagger/OpenAPI documentation into MCP tools, making them accessible to MCP-compatible clients.

## Features

- 🔄 **Automatic Tool Generation**: Converts Swagger/OpenAPI endpoints to MCP tools
- 🔒 **SSL Certificate Handling**: Option to ignore SSL certificate errors for internal APIs
- 🏷️ **Custom Tool Prefixes**: Organize tools with custom prefixes for better organization
- 📡 **Stdio Transport**: Uses stdio format as the default transport mechanism
- 🌐 **Flexible Input**: Supports both URL and local file swagger documentation
- 🔧 **Parameter Support**: Handles path, query, and body parameters
- 📝 **Type Mapping**: Maps Swagger types to JSON Schema types for proper validation

## Installation

### Global Installation

```bash
npm install -g mcp-swagger
```

### From Source

```bash
git clone https://github.com/HainanZhao/mcp-swagger.git
cd mcp-swagger
npm install
npm run build
```

## Usage

### Command Line Options

```bash
mcp-swagger [options]

Options:
  -u, --doc-url <url>      URL to swagger documentation
  -f, --doc-file <file>    Path to local swagger file
  -p, --tool-prefix <prefix>   Custom prefix for generated tools
  -b, --base-url <url>         Override base URL for API calls
  --ignore-ssl                 Ignore SSL certificate errors
  -a, --auth-header <header>   Authentication header (e.g., "Bearer token")
  -h, --help                   Display help information
  -V, --version                Display version number
```

### Examples

#### Load from URL with custom prefix

```bash
mcp-swagger --doc-url https://api.example.com/swagger.json --tool-prefix example --ignore-ssl
```

#### Load from local file

```bash
mcp-swagger --doc-file ./api-docs.json --tool-prefix local-api
```

#### With authentication

```bash
mcp-swagger --doc-url https://api.example.com/swagger.json --auth-header "Bearer your-token-here"
```

#### Override base URL

```bash
mcp-swagger --doc-file ./swagger.json --base-url https://staging.api.com --tool-prefix staging
```

## Configuration

The server can be configured through command-line arguments or environment variables:

| CLI Option      | Environment Variable      | Description                       |
| --------------- | ------------------------- | --------------------------------- |
| `--doc-url`     | `SWAGGER_DOC_URL`         | URL to swagger documentation      |
| `--doc-file`    | `SWAGGER_DOC_FILE`        | Path to local swagger file        |
| `--tool-prefix` | `SWAGGER_TOOL_PREFIX`     | Custom prefix for generated tools |
| `--base-url`    | `SWAGGER_BASE_URL`        | Override base URL for API calls   |
| `--ignore-ssl`  | `SWAGGER_IGNORE_SSL=true` | Ignore SSL certificate errors     |
| `--auth-header` | `SWAGGER_AUTH_HEADER`     | Authentication header             |

### Using Environment Variables

You can set environment variables to avoid passing command-line arguments repeatedly:

```bash
# Set environment variables
export SWAGGER_DOC_URL="https://api.example.com/swagger.json"
export SWAGGER_TOOL_PREFIX="myapi"
export SWAGGER_BASE_URL="https://staging.api.com"
export SWAGGER_IGNORE_SSL="true"
export SWAGGER_AUTH_HEADER="Bearer your-token-here"

# Run the server (will use environment variables)
mcp-swagger
```

### Environment Variables in MCP Configuration

You can also use environment variables in your MCP client configuration:

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mcp-swagger",
      "env": {
        "SWAGGER_DOC_URL": "https://example.com/swagger.json",
        "SWAGGER_TOOL_PREFIX": "example",
        "SWAGGER_IGNORE_SSL": "true"
      }
    }
  }
}
```

## MCP Integration

Add to your Agent configuration (e.g. `claude_desktop_config.json` or `~/.gemini/settings.json`):

```json
{
  "mcpServers": {
    "swagger-api": {
      "command": "mcp-swagger",
      "args": [
        "--doc-url",
        "https://example.com/swagger.json",
        "--tool-prefix",
        "example",
        "--ignore-ssl"
      ]
    }
  }
}
```

### Other MCP Clients

The server uses the standard MCP stdio transport, so it should work with any MCP-compatible client. Start the server and connect via stdin/stdout.

## Generated Tools

### Tool Naming Convention

Tools are named using the following pattern:

- `{prefix}_{method}_{path_segments}`
- Path parameters are converted to `by_{parameter_name}`

**Examples:**

- `GET /v1/users/` → `myapi_get_v1_users`
- `GET /v1/users/{id}` → `myapi_get_v1_users_by_id`
- `POST /v1/users/` → `myapi_post_v1_users`

### Parameter Mapping

- **Path parameters**: Included in the URL path
- **Query parameters**: Added as URL query string
- **Body parameters**: Sent as JSON request body
- **Header parameters**: Added to request headers

### Type Mapping

| Swagger Type | JSON Schema Type |
| ------------ | ---------------- |
| `string`     | `string`         |
| `integer`    | `number`         |
| `boolean`    | `boolean`        |
| `array`      | `array`          |
| `object`     | `object`         |

## Sample Swagger Document

The server has been tested with the following sample swagger document structure:

```json
{
  "swagger": "2.0",
  "info": {
    "title": "API Documentation",
    "version": "1.0"
  },
  "host": "api.example.com",
  "basePath": "/api",
  "paths": {
    "/v1/hosts/": {
      "get": {
        "summary": "Get a list of hosts",
        "parameters": [
          {
            "name": "filter_by",
            "in": "query",
            "type": "string",
            "description": "Filter criteria"
          }
        ]
      }
    },
    "/v1/hosts/{name}": {
      "get": {
        "summary": "Get host by name",
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ]
      }
    }
  }
}
```

This would generate tools like:

- `example_get_v1_hosts` - List hosts with optional filtering
- `example_get_v1_hosts_by_name` - Get specific host by name

## Error Handling

The server includes comprehensive error handling:

- **SSL Certificate Errors**: Can be ignored with `--ignore-ssl` flag
- **Network Errors**: Returned as error responses with details
- **Invalid Swagger**: Validation errors are reported during startup
- **Missing Parameters**: Parameter validation based on swagger schema
- **HTTP Errors**: API response errors are captured and returned

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Test with sample swagger file
npm run test
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors**

   - Use `--ignore-ssl` flag for internal APIs with self-signed certificates

2. **Tool Name Conflicts**

   - Use `--tool-prefix` to add unique prefixes to avoid naming conflicts

3. **Base URL Issues**

   - Use `--base-url` to override the base URL from swagger documentation

4. **Authentication Failures**
   - Provide proper authentication header with `--auth-header`

### Debug Mode

The server logs important information to stderr:

- Swagger document loading status
- Number of tools generated
- Tool generation details

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:

- Create an issue on GitHub
- Check the troubleshooting section above
- Review the sample configurations
