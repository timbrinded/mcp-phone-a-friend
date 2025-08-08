import * as S from "@effect/schema/Schema"

export const ProviderCapabilities = S.Struct({
  text: S.optional(S.Boolean),
  stream: S.optional(S.Boolean),
})

export const ProviderModel = S.Struct({
  provider: S.String,
  id: S.String,
  capabilities: ProviderCapabilities,
})
export type ProviderModel = typeof ProviderModel.Type
