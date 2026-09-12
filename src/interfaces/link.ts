// Ported from psicol-panel's `interfaces/link.interface.ts`. Named without
// the `.interface` suffix to match administration-panel's existing file
// naming convention (user.ts, generation.ts, api.ts — no dot-interface
// suffix anywhere in this app).
export interface LinkInterface {
  title: string
  disabled: boolean
  href: string
}
