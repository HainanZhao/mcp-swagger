#!/usr/bin/env node

/**
 * Interactive CLI tool to test MCP swagger server
 * Allows you to manually send MCP requests and see responses
 */

const { spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const config =  {
  args: [
    'dist/index.js',
    '--doc-url', 'https://petstore.swagger.io/v2/swagger.json',
    '--tool-prefix', 'petstore'
  ]
};

console.log('🚀 Interactive MCP Swagger Server Test');
console.log('Command: node', config.args.join(' '));
console.log('');

let requestId = 1;
let mcpServer;
let tools = [];

function startServer() {
  mcpServer = spawn('node', config.args, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcpServer.stdout.on('data', (data) => {
    const responses = data.toString().trim().split('\n');
    responses.forEach(response => {
      if (response.trim()) {
        try {
          const parsed = JSON.parse(response);
          console.log('📥 Response:', JSON.stringify(parsed, null, 2));
          
          // Store tools for easy reference
          if (parsed.result && parsed.result.tools) {
            tools = parsed.result.tools;
            console.log(`\n🔧 Found ${tools.length} tools. Type 'list' to see them.`);
          }
        } catch (e) {
          console.log('📥 Raw response:', response);
        }
      }
    });
    showPrompt();
  });

  mcpServer.stderr.on('data', (data) => {
    console.log('❌', data.toString());
    showPrompt();
  });

  mcpServer.on('close', (code) => {
    console.log(`🏁 Server process exited with code ${code}`);
    process.exit(code);
  });

  // Auto-initialize
  setTimeout(() => {
    sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'interactive-client', version: '1.0.0' }
    });
  }, 500);
}

function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method: method,
    params: params
  };
  
  console.log('📤 Sending:', JSON.stringify(request, null, 2));
  mcpServer.stdin.write(JSON.stringify(request) + '\n');
}

function parseCallCommand(input) {
  // Parse: toolName arg1 arg2 "quoted arg" {...json...}
  const parts = [];
  let current = '';
  let inQuotes = false;
  let inJson = false;
  let braceCount = 0;
  
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    
    if (char === '"' && !inJson) {
      inQuotes = !inQuotes;
    } else if (char === '{' && !inQuotes) {
      inJson = true;
      braceCount = 1;
      current += char;
    } else if (char === '}' && inJson && !inQuotes) {
      braceCount--;
      current += char;
      if (braceCount === 0) {
        inJson = false;
      }
    } else if (char === '{' && inJson && !inQuotes) {
      braceCount++;
      current += char;
    } else if (char === ' ' && !inQuotes && !inJson) {
      if (current.trim()) {
        parts.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return {
    toolName: parts[0] || '',
    args: parts.slice(1)
  };
}

function parseToolArguments(tool, userArgs) {
  const toolArgs = {};
  
  if (!tool.inputSchema || !tool.inputSchema.properties) {
    return toolArgs;
  }
  
  const properties = tool.inputSchema.properties;
  const required = tool.inputSchema.required || [];
  const propertyNames = Object.keys(properties);
  
  // If only one argument and it looks like JSON, try to parse it
  if (userArgs.length === 1 && userArgs[0].startsWith('{')) {
    try {
      const jsonArgs = JSON.parse(userArgs[0]);
      console.log(`📝 Using JSON arguments:`, jsonArgs);
      return jsonArgs;
    } catch (e) {
      console.log(`⚠️  Invalid JSON, treating as string: ${e.message}`);
    }
  }
  
  // Map positional arguments to parameter names in order
  userArgs.forEach((arg, index) => {
    if (index < propertyNames.length) {
      const paramName = propertyNames[index];
      const paramSchema = properties[paramName];
      
      // Remove quotes if present
      let value = arg;
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      // Type conversion
      if (paramSchema.type === 'number' || paramSchema.type === 'integer') {
        const num = Number(value);
        if (!isNaN(num)) {
          toolArgs[paramName] = num;
        } else {
          console.log(`⚠️  Warning: "${value}" is not a valid number for ${paramName}, using as string`);
          toolArgs[paramName] = value;
        }
      } else if (paramSchema.type === 'boolean') {
        toolArgs[paramName] = value.toLowerCase() === 'true';
      } else if (paramSchema.type === 'array') {
        // Try to parse as JSON array, otherwise split by comma
        try {
          toolArgs[paramName] = JSON.parse(value);
        } catch {
          toolArgs[paramName] = value.split(',').map(s => s.trim());
        }
      } else {
        toolArgs[paramName] = value;
      }
    }
  });
  
  // Show what parameters were mapped
  if (Object.keys(toolArgs).length > 0) {
    console.log(`📝 Mapped arguments:`, toolArgs);
  }
  
  // Show missing required parameters
  const missingRequired = required.filter(param => !(param in toolArgs));
  if (missingRequired.length > 0) {
    console.log(`⚠️  Missing required parameters: ${missingRequired.join(', ')}`);
    console.log(`💡 Available parameters: ${propertyNames.join(', ')}`);
  }
  
  return toolArgs;
}

function showPrompt() {
  rl.question('\n> ', handleInput);
}

function handleInput(input) {
  const trimmed = input.trim().toLowerCase();
  
  if (trimmed === 'exit' || trimmed === 'quit') {
    mcpServer.kill();
    rl.close();
    return;
  }
  
  if (trimmed === 'help') {
    showHelp();
    showPrompt();
    return;
  }
  
  if (trimmed === 'list') {
    sendRequest('tools/list');
    return;
  }
  
  if (trimmed.startsWith('call ')) {
    const callArgs = input.substring(5).trim(); // Use original input to preserve case and quotes
    const parts = parseCallCommand(callArgs);
    const toolNameQuery = parts.toolName;
    const userArgs = parts.args;
    
    const tool = tools.find(t => t.name.toLowerCase().includes(toolNameQuery.toLowerCase()));
    
    if (tool) {
      console.log(`\nCalling tool: ${tool.name}`);
      console.log(`Description: ${tool.description}`);
      
      // Parse and validate arguments
      const toolArgs = parseToolArguments(tool, userArgs);
      
      sendRequest('tools/call', {
        name: tool.name,
        arguments: toolArgs
      });
    } else {
      console.log(`❌ Tool not found: ${toolNameQuery}`);
      console.log('Available tools:', tools.map(t => t.name).join(', '));
      showPrompt();
    }
    return;
  }
  
  if (trimmed.startsWith('raw ')) {
    try {
      const jsonStr = input.substring(4);
      const request = JSON.parse(jsonStr);
      request.jsonrpc = '2.0';
      request.id = requestId++;
      
      console.log('📤 Sending raw request:', JSON.stringify(request, null, 2));
      mcpServer.stdin.write(JSON.stringify(request) + '\n');
    } catch (e) {
      console.log('❌ Invalid JSON:', e.message);
      showPrompt();
    }
    return;
  }
  
  console.log('❌ Unknown command. Type "help" for available commands.');
  showPrompt();
}

function showHelp() {
  console.log(`
📖 Available Commands:
======================

help                    - Show this help message
list                    - List all available tools
call <tool> [args...]   - Call a tool with optional arguments
raw <json>              - Send raw MCP request (without jsonrpc/id fields)
exit/quit               - Exit the interactive session

Tool Call Examples:
  list
  call getPetById 779
  call getUserByName "john_doe"
  call findPetsByStatus available
  call addPet {"name": "Fluffy", "category": {"name": "cat"}}
  call loginUser admin password123
  
Argument Types:
  - Strings: "quoted text" or unquoted_text
  - Numbers: 123 or 45.67
  - Booleans: true or false
  - Arrays: ["item1", "item2"] or comma,separated,values
  - Objects: {"key": "value", "nested": {"data": true}}
  
💡 Arguments are mapped to parameters in the order they appear in the tool schema.
💡 Use 'list' to see all tools and their required parameters.

Current tools: ${tools.length > 0 ? tools.map(t => t.name).join(', ') : 'None loaded yet'}
`);
}

console.log('Starting server...');
startServer();

// Show initial help after server starts
setTimeout(() => {
  console.log('\n💡 Type "help" for available commands, "list" to see tools');
  showPrompt();
}, 2000);
