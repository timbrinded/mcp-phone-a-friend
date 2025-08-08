#!/usr/bin/env bun
import { PhoneAFriendServer } from './server.js';

async function main() {
  const server = new PhoneAFriendServer();
  await server.start();
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});