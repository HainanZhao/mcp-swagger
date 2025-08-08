#!/usr/bin/env node

/**
 * Debug script to check what URLs the MCP server is actually calling
 */

const { spawn } = require('child_process');

console.log('🔍 Debugging MCP Server URL Construction');
console.log('=========================================');

// Test direct API calls first to verify endpoints work
console.log('\n1. Testing direct API calls...');

const testEndpoints = [
  'https://petstore.swagger.io/v2/pet/findByStatus?status=available',
  'https://petstore.swagger.io/v2/pet/100',
  'https://petstore.swagger.io/v2/store/inventory'
];

async function testDirectCalls() {
  for (const url of testEndpoints) {
    try {
      const response = await fetch(url);
      console.log(`✅ ${url} -> ${response.status}`);
      if (response.status === 200) {
        const text = await response.text();
        console.log(`   Response: ${text.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ ${url} -> ${error.message}`);
    }
  }
}

// Test with the MCP server and capture verbose output
console.log('\n2. Testing MCP server with verbose logging...');

function testMCPServer() {
  return new Promise((resolve) => {
    const server = spawn('node', [
      'dist/index.js',
      '--doc-url', 'https://petstore.swagger.io/v2/swagger.json',
      '--tool-prefix', 'petstore',
      '--base-url', 'https://petstore.swagger.io/v2'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DEBUG: '*' }
    });

    let requestId = 1;

    server.stdout.on('data', (data) => {
      console.log('📥 STDOUT:', data.toString());
    });

    server.stderr.on('data', (data) => {
      console.log('📥 STDERR:', data.toString());
    });

    // Initialize and test
    setTimeout(() => {
      const initRequest = {
        jsonrpc: '2.0',
        id: requestId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'debug-client', version: '1.0.0' }
        }
      };
      server.stdin.write(JSON.stringify(initRequest) + '\n');

      setTimeout(() => {
        const toolsRequest = {
          jsonrpc: '2.0',
          id: requestId++,
          method: 'tools/list'
        };
        server.stdin.write(JSON.stringify(toolsRequest) + '\n');

        setTimeout(() => {
          const callRequest = {
            jsonrpc: '2.0',
            id: requestId++,
            method: 'tools/call',
            params: {
              name: 'petstore_getInventory',
              arguments: {}
            }
          };
          server.stdin.write(JSON.stringify(callRequest) + '\n');

          setTimeout(() => {
            server.kill();
            resolve();
          }, 2000);
        }, 1000);
      }, 1000);
    }, 1000);
  });
}

// Run tests
testDirectCalls().then(() => {
  return testMCPServer();
}).then(() => {
  console.log('\n✅ Debug tests completed');
});
