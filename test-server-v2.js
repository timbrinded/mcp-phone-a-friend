#!/usr/bin/env bun

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testServer() {
  console.log('Starting MCP server test v2...');
  
  // Start the server with test API keys
  const server = spawn('bun', ['run', 'src/index.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { 
      ...process.env, 
      OPENAI_API_KEY: 'test-key',
      XAI_API_KEY: 'test-xai-key',
      GOOGLE_API_KEY: 'test-google-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key'
    }
  });

  // Handle server stderr (logs)
  server.stderr.on('data', (data) => {
    console.error(`[SERVER LOG] ${data.toString().trim()}`);
  });

  // Wait for server to start
  await setTimeout(1000);

  // Test 1: Initialize
  console.log('\n=== Test 1: Initialize ===');
  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: {
        name: 'test-client-v2',
        version: '2.0.0'
      }
    },
    id: 1
  }) + '\n';
  
  server.stdin.write(initRequest);
  
  // Test 2: List tools
  await setTimeout(500);
  console.log('\n=== Test 2: List Tools ===');
  const listRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 2
  }) + '\n';
  
  server.stdin.write(listRequest);
  
  // Test 3: Call models tool
  await setTimeout(500);
  console.log('\n=== Test 3: List Models ===');
  const modelsRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'models',
      arguments: {}
    },
    id: 3
  }) + '\n';
  
  server.stdin.write(modelsRequest);

  // Test 4: Invalid tool call (test error handling)
  await setTimeout(500);
  console.log('\n=== Test 4: Invalid Tool (Error Handling) ===');
  const invalidToolRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'invalid-tool',
      arguments: {}
    },
    id: 4
  }) + '\n';
  
  server.stdin.write(invalidToolRequest);

  // Test 5: Invalid parameters (test validation)
  await setTimeout(500);
  console.log('\n=== Test 5: Invalid Parameters (Input Validation) ===');
  const invalidParamsRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'advice',
      arguments: {
        model: '',  // Empty string should fail validation
        prompt: 'test'
      }
    },
    id: 5
  }) + '\n';
  
  server.stdin.write(invalidParamsRequest);

  // Test 6: Model not found
  await setTimeout(500);
  console.log('\n=== Test 6: Model Not Found ===');
  const modelNotFoundRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'advice',
      arguments: {
        model: 'invalid:model',
        prompt: 'test prompt'
      }
    },
    id: 6
  }) + '\n';
  
  server.stdin.write(modelNotFoundRequest);

  // Collect responses
  let responses = '';
  server.stdout.on('data', (data) => {
    responses += data.toString();
  });

  // Wait and display results
  await setTimeout(2000);
  
  console.log('\n=== Server Responses ===');
  responses.split('\n').filter(line => line.trim()).forEach(line => {
    try {
      const json = JSON.parse(line);
      console.log(`\nResponse for request ${json.id}:`);
      if (json.error) {
        console.log('ERROR:', json.error);
      } else {
        console.log('SUCCESS:', JSON.stringify(json.result, null, 2));
      }
    } catch {
      console.log('Raw response:', line);
    }
  });

  // Clean up
  server.kill();
  process.exit(0);
}

testServer().catch(console.error);