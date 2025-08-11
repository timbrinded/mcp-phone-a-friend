#!/usr/bin/env bun
import { ModelAgencyServer } from './server.js';

async function main() {
  const server = new ModelAgencyServer();
  await server.start();
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});