# NUSMU 
Members: 
* Goh Min Rui (@minrui13) 
* Su Myat Myat Htay (@sumyatmyathtay) 
* Marcus Yeong Mun Hong (@mxrcxsz12) 
* Tham Jodena (@j0-oj)
# SetUp Instructions
1. Clone respository
`git clone https://github.com/minrui13/NUSMU_TikTok.git`
`cd NUSMU_TikTok`
2. Install Dependencies
`npm install`
3. Configure env
`cp .env.example .env`
* Add API keys & App token
```
APP_AUTH_TOKEN=super-secret-local-dev-token-12345

ARK_API_KEY=replace-with-your-ark-api-key
ARK_MODEL=ep-replace-with-your-endpoint-id
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```
4. Start Docker Destop
5. Run `npm run poc`

# Project Intro 
## The Avengers
The Avengers is a middleware layer for the Agent Launchpad that makes AI Agent actions safer, more accountable, and easier to understand.

## Problem Statement 
As mentioned in the problem statement, the AI Agents in the Agent Launchpad are capable of performing any task to fulfill a user's prompt. However, just like any of us, we aren't always aware of exactly what an Agent is attempting to do. An Agent might receive more permissions than it needs, accidentally expose credentials, access another Agent's workspace, or execute a dangerous action without human oversight. Additionally, when multi-agent collaboration is involved, it becomes crucial to know which Agent acted, which human initiated the task, how the Agents coordinated, and whether the shared session contains suspicious activity.

So we ask ourselves, as users, what do we need to know before letting an Agent act?
* Who initiated this action?
* What is the Agent attempting to do?
* Is the Agent allowed to do it?
* How risky is the action?
* Should a human approve it?
* What happened after the decision?
* Can sensitive information appear in the logs or interface?
* Which Agent produced a particular result in a shared session?

This is where we assemble our Avengers.

## Our Solution: Assemble the Avengers
## 1. Create an Agent
The user creates an Agent through the **Agent Launchpad** and gives it a name, description, and instructions.  
When the Agent is created, it receives a least‑privilege ability profile:

- **Read workspace files** → Enabled  
- **Write workspace files** → Enabled  
- **Run shell commands** → Disabled  
- **Access secrets** → Disabled  
- **Use network** → Disabled  
- **Join shared sessions** → Disabled  

[!Note]
The user can manage these abilities through the **Abilities view**.  
Each ability includes a description and risk level so that the user can understand what the Agent is allowed to do.

**Examples:**
- A Documentation Agent may read and edit Markdown files but cannot run shell commands.  
- A Testing Agent may run approved test commands but cannot access secrets.  
- A Research Agent may use the network but cannot modify the workspace.  

> The Agent’s abilities are stored on the backend.  
> The frontend only provides the interface for managing them; it is not responsible for enforcing them.
---
## 2. Send the Agent a Task

The user selects an Agent in the **Playground** and sends a prompt.

**Example:**

