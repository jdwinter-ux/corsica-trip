// Single source of truth for the Claude models used by the AI endpoints.
// When Anthropic retires a model, change the default here once — or set the
// matching env var in the Vercel project to override without a deploy. No need
// to touch the individual call sites.
//
// - ANTHROPIC_MODEL: the chat guide (fast/cost-effective Sonnet).
// - ANTHROPIC_VISION_MODEL: photo identification — the strongest vision model
//   (Opus), paired with extended thinking in identify.js for better recognition.
//
// Deprecation schedule:
// https://platform.claude.com/docs/en/docs/about-claude/model-deprecations
//
// (Underscore-prefixed filename so Vercel does not expose this as an API route.)
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
export const ANTHROPIC_VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL || 'claude-opus-4-8';
