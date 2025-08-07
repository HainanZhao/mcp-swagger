# MCP Swagger Server Implementation Plan

## Project Overview
Create an MCP server that automatically converts REST APIs with Swagger documentation into MCP tools, making them available for use with MCP-compatible clients.

## Requirements
1. Convert Swagger/OpenAPI documentation to MCP tools
2. Ignore SSL certificate issues for internal APIs
3. Support custom tool prefixes for organization
4. Use stdio format as default transport
5. Handle Swagger 2.0 format (extensible to OpenAPI 3.x)

## Implementation Plan

### Phase 1: Project Setup
- [x] Create todo.md file
- [x] Initialize Node.js/TypeScript project with package.json
- [x] Set up TypeScript configuration
- [x] Install core dependencies:
  - @modelcontextprotocol/sdk-typescript
  - axios (for HTTP requests)
  - swagger-parser (for parsing swagger docs)
  - https (for SSL handling)

### Phase 2: Core Infrastructure
- [x] Create main server entry point (src/index.ts)
- [x] Set up MCP server with stdio transport
- [x] Implement configuration loading (CLI args, env vars)
- [x] Add logging and error handling

### Phase 3: Swagger Processing
- [x] Create swagger document loader (URL or file)
- [x] Implement swagger parser with validation
- [x] Create tool name generator with prefix support
- [x] Map HTTP methods to MCP tool operations

### Phase 4: Tool Generation
- [x] Convert swagger paths to MCP tool definitions
- [x] Handle different parameter types (path, query, body)
- [x] Generate appropriate JSON schemas for parameters
- [x] Create tool descriptions from swagger documentation

### Phase 5: HTTP Client
- [x] Implement HTTP client with SSL cert ignoring
- [x] Handle different authentication methods
- [x] Support various content types (JSON, form data)
- [x] Add request/response logging

### Phase 6: Testing & Documentation
- [x] Test with provided sample swagger document
- [x] Create comprehensive README with usage examples
- [x] Add error handling for edge cases
- [x] Validate tool output format

### Phase 7: Advanced Features
- [ ] Support for OpenAPI 3.x format
- [ ] Configuration file support (JSON/YAML)
- [ ] Tool filtering and selection
- [ ] Response caching (optional)

## Sample Swagger Document Analysis
The provided swagger doc contains:
- Host management endpoints (/v1/hosts/)
- Organization endpoints (/v1/org/groups, /v1/org/teams, /v1/org/users)
- Various parameter types (path, query)
- Complex response schemas with references

## Expected Tool Names (with prefix "infra_")
- infra_get_hosts
- infra_get_host_by_name
- infra_get_groups
- infra_get_group_by_name
- infra_get_teams
- infra_get_team_by_id
- infra_get_users
- infra_search_users
- infra_get_user_by_username

## Configuration Options
- `swagger_url`: URL to swagger documentation
- `swagger_file`: Local swagger file path
- `tool_prefix`: Custom prefix for generated tools
- `base_url`: Override base URL for API calls
- `ignore_ssl`: Boolean to ignore SSL certificate errors
- `auth_header`: Optional authentication header