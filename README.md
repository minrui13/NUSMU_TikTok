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
- **Use network**  Disabled  
- **Join shared sessions** → Disabled  

> The user can manage these abilities through the **Abilities view**.  
> Each ability includes a description and risk level so that the user can understand what the Agent is allowed to do.

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
Prompt: "Run the project tests and fix any failures."
Before the task reaches the Agent Runtime, the middleware evaluates it:
```
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
The middleware identifies the capabilities that may be required, such as reading files, writing files, running commands, accessing secrets, or using the network.

---
## 3. Middleware makes the decision
The middleware compares the requested capabilities with the Agent’s permission profile.
If the Agent does not have the required ability, the request is denied before execution:
**Example:**
The Agent does not have `canRunCommand`. 
→ The Run is blocked. 
→ The Agent Runtime is never called. 
→ A reason is shown to the user. 
→ An audit event is recorded.

---
## 4. High-Risk Actions Require Approval

Having an ability does not always mean that an action can run immediately.  

- **Low- and medium-risk actions** → proceed when the Agent has the required ability.  
- **High- and critical-risk actions** → require an additional human decision.

**Example:**
Agent has `canRunCommand` 
+ command execution is high risk
+ → Run becomes pending_approval
The user will be prompted to either approve or deny the agent of the request:
* If the user approves the request, the Agent Runtime executes the Run.
* If the user denies it, the Run is stopped. Both decisions are recorded in the audit history.
- Both decisions are recorded in the audit history.
> Changing an Agent’s permissions does not automatically approve an existing pending Run. 
> The user must explicitly approve that particular Ru
---
## 5. Agent Immune detects suspicious behaviour
In parallel with the ability check, Agent Immune analyses the request for suspicious patterns.
It can identify:
* Prompt injection.
* Credential access.
* Sensitive resource access.
* Data exfiltration.
* Suspicious network access.
* Workspace escape.
* Destructive actions.
* Privilege escalation.
* 
The system calculates a risk score and applies the configured thresholds:
- **0–39** → Allow  
- **40–79** → Human review  
- **80–100** → Automatically block
  
**Example:**
- **Credential request** +25 
- **External data transmission** +20 
- **Suspicious network destination** +12 
- **Credential and exfiltration** +10 
- **Sensitive resource access** +18 
------------------------------------------------ 
- **Final risk** 85
Because the final score is 85, the request is automatically blocked before reaching the runtime.
---
## 7. Secrets Are Protected
If a prompt, response, error, tool result, or audit event contains a credential or token, the redaction layer removes or replaces it before the content is stored or displayed.
**Example:**
**Before:**
Authorization: Bearer abc123...
**After:**
Authorization: [REDACTED]

This prevents sensitive values from appearing in the conversation history, audit table, logs, screenshots, or frontend responses.

---
## 8. Every Important Decision Is Recorded

The **audit history** provides a permanent explanation of what happened.  
Each event can record:
* User
* Agent
* Run
* Session
* Action
* Risk
* Decision
* Reason
* Timestamp
  
The audit table allows users to review both successful and unsuccessful actions. This turns the middleware from an invisible security check into visible evidence that the Agent was governed.

---
## 9. Alternative Flow: Assemble the Avengers
Users can add a group task, where they involved multiple agents to do a task.
The overarching idea: 
User creates group task
    ↓
Mentioned Agents are identified
    ↓
A shared session is created
    ↓
The coordinator selects the next Agent
    ↓
The Agent receives the shared conversation history
    ↓
The Agent produces a turn
    ↓
The next Agent continues
Each Agent remains subject to its own ability and policy checks. The coordinator also records the participating Agent, turn order, and shared `sessionId`.
**Example:**
The group task can show:
Turn 1 → Research Agent
Turn 2 → Coding Agent
Turn 3 → Testing Agent

The coordinator detects duplicate responses, timeouts, skipped turns, and completion markers. All coordination activity is stored in the same audit system as single-Agent Runs.

