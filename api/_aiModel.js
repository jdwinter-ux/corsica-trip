// Single source of truth for the Claude model used by the AI endpoints
// (chat + photo identify). When Anthropic retires a model, change the default
// here once — or set ANTHROPIC_MODEL in the Vercel project env to override
// without a deploy. No need to touch the individual call sites.
//
// Deprecation schedule:
// https://platform.claude.com/docs/en/docs/about-claude/model-deprecations
//
// (Underscore-prefixed filename so Vercel does not expose this as an API route.)
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
