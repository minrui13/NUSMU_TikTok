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

## Our Solution
### User Flow
1. Creating an Agent
A user creates an Agent through the existing Agent Launchpad interface. The Agent receives a default least-privilege ability profile.
```
Read workspace files Enabled 
Write workspace files Enabled 
Run shell commands Disabled
Access secrets Disabled 
Use network Disabled 
Join shared sessions Disabled
```
> [!NOTE]
The user can manage the Agent’s predefined abilities through the Abilities view on the sidebar. The interface displays the ability description and risk level so that the user understands the consequences of enabling it.

### Sending a task 
The user sends a task through the Playground.
Before the task reaches the Agent Runtime:
```
For example:

Run the project tests and fix any failures.

Before the task reaches the Agent Runtime, the middleware evaluates it:

User prompt
    ↓
Action classification
    ↓
Agent Immune threat detection
    ↓
Risk scoring
    ↓
Ability and policy check
```
The system identifies capabilities that may be required, such as reading files, writing files, running commands, accessing secrets, or using the network.
### Middleware 



