import { Context, Effect, Layer } from "effect"

// Simple service for testing Effect architecture
export class SimpleService extends Context.Tag("SimpleService")<
  SimpleService,
  {
    readonly getMessage: Effect.Effect<string>
    readonly addNumbers: (a: number, b: number) => Effect.Effect<number>
  }
>() {}

// Implementation using Layer
export const SimpleServiceLive = Layer.succeed(
  SimpleService,
  SimpleService.of({
    getMessage: Effect.succeed("Hello from Effect service!"),
    addNumbers: (a: number, b: number) => Effect.succeed(a + b)
  })
)