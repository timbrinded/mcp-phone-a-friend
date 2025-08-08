#!/usr/bin/env bun

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testServer() {
  console.log('Starting MCP server...');
  
  // Start the server
  const server = spawn('bun', ['run', 'src/index.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, OPENAI_API_KEY: 'test-key' }
  });

  // Handle server stderr (logs)
  server.stderr.on('data', (data) => {
    console.error(`[SERVER LOG] ${data.toString().trim()}`);
  });

  // Wait for server to start
  await setTimeout(1000);

  // Test 1: Initialize
  console.log('\nTest 1: Sending initialize request...');
  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    },
    id: 1
  }) + '\n';
  
  server.stdin.write(initRequest);
  
  // Test 2: List tools
  await setTimeout(500);
  console.log('\nTest 2: Sending tools/list request...');
  const listRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 2
  }) + '\n';
  
  server.stdin.write(listRequest);
  
  // Test 3: Call models tool
  await setTimeout(500);
  console.log('\nTest 3: Calling models tool...');
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
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(line);
    }
  });

  // Clean up
  server.kill();
  process.exit(0);
}

testServer().catch(console.error);