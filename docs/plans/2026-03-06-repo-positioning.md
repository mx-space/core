# Repository Positioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reposition the repository as an AI-powered CMS core for personal blogs and creator websites, and align the public-facing GitHub metadata with the actual product capabilities.

**Architecture:** Keep the codebase unchanged and update only public-facing repository assets. The changes should reflect the existing AI module capabilities already present in the backend, including provider management, summary generation, translation, writing assistance, and comment moderation.

**Tech Stack:** GitHub repository metadata, Markdown documentation, NestJS monorepo context.

---

### Task 1: Refresh repository messaging

**Files:**
- Modify: `README.md`

**Step 1: Identify the product's current strengths**

Review the existing modules and confirm the messaging should emphasize:
- multi-provider LLM support
- AI summaries
- AI translation
- AI writing assistance
- AI comment moderation
- self-hosted blog CMS workflows

**Step 2: Rewrite the README hero copy**

Update the opening section so the repository is immediately described as an AI-powered CMS core for personal blogs and creator websites.

**Step 3: Add a feature-oriented structure**

Organize the README around:
- product positioning
- key AI capabilities
- monorepo package layout
- quick start
- related projects
- license

**Step 4: Review wording**

Make sure the README is concise, GitHub-friendly, and aimed at independent bloggers rather than generic backend developers.

### Task 2: Update GitHub repository metadata

**Files:**
- External: GitHub repository settings for `mx-space/core`

**Step 1: Replace the repository description**

Use a description that highlights:
- AI-powered CMS
- personal blogs / creator websites
- summaries, translation, moderation, writing workflows

**Step 2: Replace repository topics**

Use a topic set aligned with the current product direction:
- `ai`
- `ai-cms`
- `blog-cms`
- `personal-blog`
- `creator-tools`
- `headless-cms`
- `llm`
- `ai-summary`
- `ai-translation`
- `content-workflow`
- `self-hosted`
- `nestjs`
- `typescript`
- `mongodb`
- `redis`

**Step 3: Verify the metadata**

Fetch the repository metadata after updating it and confirm the new description and topics are live.
