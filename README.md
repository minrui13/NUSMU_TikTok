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
As mentioned in the problem statement, the AI Agents in the Agent Launchpad are capable of doing any tasks to fufil the user's prompt. However, like many of us sometimes, we are not aware of exactly what an Agent is attempting to do. An Agent may receive more permissions than it needs, accidentally expose credentials, access another Agent’s workspace, or perform a dangerous action without human awareness. Additionally, when working with other agents, it becomes important to know know which Agent acted, which human initiated the task, how the Agents were coordinated, and whether the shared conversation contains suspicious activity.

So we ask ourselves, as a user what would we want the the Agent to do:
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
### User Story






