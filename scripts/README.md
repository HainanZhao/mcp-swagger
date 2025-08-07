# Test Scripts for MCP Swagger Server

This directory contains test scripts to help you test and debug the MCP swagger server.

## Available Scripts

### 1. Package.json Scripts

Run these from the project root:

```bash
# Test with Swagger Petstore API (public)
npm run test:petstore

# Test with example company API (internal)
npm run test:your-company

# Run basic MCP protocol test
npm run test:local

# Run tool listing and testing
npm run test:tools
```

### 2. Individual Test Scripts

#### `test-mcp.js` - Basic MCP Protocol Test
Tests the basic MCP protocol communication:
```bash
node scripts/test-mcp.js
```

#### `test-tools.js` - Tool Testing
Lists available tools and tests them:
```bash
# Test with petstore API
node scripts/test-tools.js

# Test with example company API  
node scripts/test-tools.js your-company
```

#### `interactive.js` - Interactive Testing
Interactive CLI for manual testing:
```bash
# Test with petstore API
node scripts/interactive.js

# Test with your-company API
node scripts/interactive.js your-company
```

## Interactive Commands

When using `interactive.js`:

- `help` - Show available commands
- `list` - List all available tools
- `call <tool>` - Call a tool (supports partial name matching)
- `raw <json>` - Send raw MCP request
- `exit`/`quit` - Exit the session

## Examples

```bash
# Quick test with public API
npm run test:petstore

# Interactive testing with your API
npm run build
node scripts/interactive.js your-company

# In interactive mode:
> list
> call findPets
> call getPet
> exit
```

## Troubleshooting

1. **Build first**: Always run `npm run build` before testing
2. **SSL issues**: Use `--ignore-ssl` flag for internal APIs
3. **Check logs**: Look at stderr output for detailed error messages
4. **Test connectivity**: Verify your Swagger URL is accessible with curl first
