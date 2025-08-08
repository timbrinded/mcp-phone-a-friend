import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SimpleService, SimpleServiceLive } from "../src/services/Simple.service.js"

describe("SimpleService", () => {
  test("should return a message", async () => {
    const program = SimpleService.pipe(
      Effect.flatMap(service => service.getMessage)
    )

    const result = await Effect.provide(program, SimpleServiceLive).pipe(Effect.runPromise)
    expect(result).toBe("Hello from Effect service!")
  })

  test("should add numbers", async () => {
    const program = SimpleService.pipe(
      Effect.flatMap(service => service.addNumbers(2, 3))
    )

    const result = await Effect.provide(program, SimpleServiceLive).pipe(Effect.runPromise)
    expect(result).toBe(5)
  })
})