#!/usr/bin/env bun

import { Effect } from "effect"
import { SimpleService, SimpleServiceLive } from "./services/Simple.service.js"

console.log("🚀 Testing Effect-TS Service Architecture...")

// Demonstrate Effect service working with pipe syntax
const program = SimpleService.pipe(
  Effect.flatMap(service => 
    Effect.all([
      service.getMessage,
      service.addNumbers(10, 32)
    ])
  ),
  Effect.map(([message, sum]) => {
    console.log("✅ Service message:", message)
    console.log("✅ Service calculation:", sum)
    console.log("✅ Effect-TS architecture is working!")
    return { message, sum }
  })
)

// Run the program
Effect.provide(program, SimpleServiceLive)
  .pipe(Effect.runPromise)
  .then(result => {
    console.log("📊 Final result:", result)
  })
  .catch(console.error)