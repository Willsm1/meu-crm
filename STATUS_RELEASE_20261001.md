# Taurus Magnum — Release consolidation 2026-10-01

## Source of truth
- Production CRM remains hosted from GitHub/main.
- Validated WhatsApp/Follow-up work comes from `test/whatsapp-pilot-stable-20260930`.
- Do not modify frozen media/TXT/matching modules except after isolated regression testing.

## Validated modules to preserve
- Follow-up visual integration
- Phone matching / ambiguity handling
- WhatsApp history
- TXT conversation archive
- Private Supabase media persistence
- Media preview after observer shutdown
- Taurus knowledge retrieval
- GPT briefing assembly

## New work not yet production-approved
- Hosted multi-session WhatsApp gateway
- Per-user WhatsApp connection manager
- ChatGPT OAuth / plan-token integration

## Release rule
Integrate validated modules first. Keep new gateway/OAuth isolated until browser regression checks pass. GitHub remains the CRM host; an external runtime is needed only for persistent WhatsApp sockets.
