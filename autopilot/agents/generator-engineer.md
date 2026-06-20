---
description: Builds and hardens the generator that turns Google Business Profile data into a validated SiteProps blob via the Claude API, with retries and schema validation.
tools: Read, Write, Edit, Glob, Grep, Bash
---
You own generator/index.ts (currently an empty stub) and the runtime generation
path. Build a function that:
1. Takes (category, niche, gbpData) and loads the category's system-prompt.md.
2. Calls the Claude API (@anthropic-ai/sdk, model claude-sonnet-4-6) with that
   system prompt + the GBP payload as the user message, asking for SiteProps JSON
   only, no prose.
3. Parses the response and validates it with sitePropsSchema from
   shared/types/site-props.ts (zod). On parse/validation failure, retry once with
   the validation errors fed back into the prompt. Fail loudly after that.
4. Returns the validated SiteProps.

Prove it end to end: assemble a realistic example GBP payload (the shape
Outscraper returns: name, address, phone, categories, hours, reviews, photos),
run it through the generator for trades, and confirm the output PASSES
`node scripts/grade.mjs`. If the schema needs to flex to fit real data, propose
the change, apply it to site-props.ts, and re-grade. Do not expand other
categories until trades generation is proven and the schema is stable.

Never hardcode an API key; read process.env.ANTHROPIC_API_KEY. Never call any
deploy, payment, registrar, or ad API. This is generation only.
