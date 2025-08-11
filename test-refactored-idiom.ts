#!/usr/bin/env bun

import { handleIdiomV2 } from './src/handlers/idiom-v2.js';

async function testRefactoredIdiom() {
  console.log('Testing refactored idiom endpoint with typed model registry...\n');
  
  // Test case 1: React state management
  console.log('Test 1: React global state management');
  const test1 = await handleIdiomV2({
    task: 'Implement global state management in React',
    context: {
      dependencies: JSON.stringify({
        dependencies: {
          "react": "^18.2.0",
          "react-dom": "^18.2.0"
        }
      })
    },
    model: 'openai:gpt-4o'
  });
  
  console.log('Response:', test1.content[0].text.substring(0, 500));
  console.log('Metadata:', test1.metadata);
  console.log('\n---\n');
  
  // Test case 2: Node.js HTTP requests with retry
  console.log('Test 2: HTTP requests with retry in Node.js');
  const test2 = await handleIdiomV2({
    task: 'Make HTTP requests with automatic retry logic',
    context: {
      dependencies: JSON.stringify({
        dependencies: {
          "express": "^4.18.0"
        }
      })
    },
    model: 'openai:gpt-4o'
  });
  
  console.log('Response:', test2.content[0].text.substring(0, 500));
  console.log('Metadata:', test2.metadata);
  console.log('\n---\n');
  
  // Test case 3: Invalid model fallback
  console.log('Test 3: Testing invalid model fallback');
  const test3 = await handleIdiomV2({
    task: 'Parse JSON safely with validation',
    context: {
      language: 'typescript'
    },
    model: 'invalid:model'
  });
  
  console.log('Response:', test3.content[0].text.substring(0, 500));
  console.log('Metadata:', test3.metadata);
  console.log('\nAll tests completed successfully!');
}

testRefactoredIdiom().catch(console.error);