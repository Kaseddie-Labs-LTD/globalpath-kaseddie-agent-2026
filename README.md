# GlobalPath Kaseddie Agent

AI-powered recruiting and compliance engine for the Uganda–Canada–UAE–EU corridor.

## Vision

GlobalPath connects vetted talent from Uganda to employers across Canada, the UAE, and the European Union. The platform pairs rigorous legal compliance with practical recruiting tools so cross-border hiring remains ethical, lawful, and fast. Employers get ready-to-work candidates; candidates get fair, transparent opportunities with corridor-specific guardrails.

## Tech Stack

- React + Vite + TypeScript for a fast, typed front end.
- Apify for ingesting live job datasets across target markets.
- DigitalOcean Gradient™ AI Platform for agentic automation, knowledge grounding, and safety rails.

## Key Features

- Kaseddie Hunter Agent: A DigitalOcean Gradient agent that drafts high‑conversion B2B proposals and serves as an AI recruiting consultant.
- Global Labor Law Knowledge Base (6 countries): Curated, corridor‑specific guidance spanning Uganda, Canada, UAE, and key EU jurisdictions to keep actions compliant.
- B2B Pitch Generator: Takes Job Title, Company, and Location and returns polished proposal text ready for outreach.

## Setup

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run dev
```

## DO Gradient Integration

The Agent Workspace “Global-Labor-Operations” on DigitalOcean Gradient centralizes the compliance layer:

- Knowledge grounding: The agent consults the Global Labor Law Knowledge Base to align advice and proposals with corridor regulations.
- Policy guardrails: Workspace policies constrain outputs to lawful, ethical recommendations and prevent risky or non‑compliant actions.
- Single endpoint: Frontend requests send message payloads to the workspace’s chat/completions endpoint; the workspace orchestrates tools, context, and moderation.

This architecture ensures proposals and guidance remain accurate, jurisdiction‑aware, and operationally safe across the Uganda–Canada–UAE–EU corridor.

## API Integration

- Messages payload: The frontend sends a minimal `messages` array to the Gradient Agent chat/completions endpoint.
- Structured output: The Agent may return either plain text or a JSON object that follows the B2B proposal schema (e.g., title, company, location, pitch body, contact lines).
- Robust parsing: The client normalizes both forms—if JSON is returned, it is parsed safely; if text is returned, it is used as-is.
- Reliability: A built‑in retry (3 attempts with backoff) mitigates wake‑up latency and transient network errors.
