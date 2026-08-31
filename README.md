# NUSMU 
Members: 
* Goh Min Rui [@minrui13](https://github.com/minrui13)
* Su Myat Myat Htay [@sumyatmyathtay](https://github.com/SuMyatMyatHtay)
* Marcus Yeong Mun Hong [@mxrcxsz12](https://github.com/Mxrcxsz)
* Tham Jodena [@j0-oj](https://github.com/j0-oj)
  
# Setup Instructions

## 1. Clone the repository

```bash
git clone https://github.com/minrui13/NUSMU_TikTok.git
cd NUSMU_TikTok
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your local configuration:

```env
APP_AUTH_TOKEN=super-secret-local-dev-token-12345

ARK_API_KEY=replace-with-your-ark-api-key
ARK_MODEL=ep-replace-with-your-endpoint-id
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

> Never commit real API keys, passwords, bearer tokens, or other secrets to GitHub.

## 4. Start Docker Desktop

Ensure Docker Desktop is running before starting the platform.

## 5. Start the local platform

```bash
npm run poc
```

Open the platform at:

```text
http://localhost:3000
```

# Project Introduction

## The Avengers

**The Avengers** is a governance and coordination middleware layer for the Agent Launchpad.

The platform allows multiple specialised AI Agents to read files, write code, run commands, access external services, and collaborate with one another. The Avengers adds the security and coordination controls needed to make these capabilities safer, more accountable, and easier to understand.

Each Agent has its own:

* Identity.
* Ability profile.
* Risk context.
* Workspace.
* Audit history.
* Optional participation in shared group sessions.

Our goal is simple:

> Agents may be powerful, but they should not be trusted blindly.

# Problem Statement

AI Agents can perform complex tasks on behalf of users. However, an Agent may not always behave exactly as the user expects. It may request excessive permissions, attempt to access sensitive resources, expose credentials, perform destructive actions, or communicate with an unsafe external service.

These risks become more complicated when multiple Agents collaborate. Users need to know which Agent acted, which human initiated the task, how the Agents coordinated, and whether a suspicious action occurred during the shared session.

Without middleware, users may not know:

* Who initiated an action.
* What the Agent is attempting to do.
* Whether the Agent is allowed to perform the action.
* How risky the action is.
* Whether human approval is required.
* Why an action was allowed or blocked.
* Whether sensitive information appeared in the logs.
* Which Agent produced a particular result.
* Whether a group task completed correctly.

This is the problem The Avengers addresses.

# Our Solution: Assemble the Avengers

The Avengers combines identity, Agent abilities, threat detection, human approval, secret redaction, auditability, and Multi-Agent coordination into one governance layer.

The overall flow is:

```text
Human user
    ↓
Agent or Multi-Agent task
    ↓
Identity and ability checks
    ↓
Threat detection and risk scoring
    ↓
Allow, deny, or request approval
    ↓
Agent Runtime or GroupTaskCoordinator
    ↓
Redacted output and audit evidence
```

## 1. Create and configure an Agent

The user creates an Agent through the Agent Launchpad and provides its name, description, and instructions.

Each Agent receives a least-privilege ability profile by default:

| Ability               | Default state | Risk     |
| --------------------- | ------------- | -------- |
| Read workspace files  | Enabled       | Low      |
| Write workspace files | Enabled       | Medium   |
| Run shell commands    | Disabled      | High     |
| Access secrets        | Disabled      | Critical |
| Use network           | Disabled      | High     |
| Join shared sessions  | Disabled      | Medium   |

Users can manage these abilities through the **Abilities** view. The interface shows each ability’s purpose and risk level so that users can make informed decisions.

For example:

* A Documentation Agent can read and edit Markdown files but cannot run shell commands.
* A Testing Agent can run approved test commands but cannot access secrets.
* A Research Agent can use the network but cannot modify the workspace.
* A Coordination Agent can participate in shared sessions but cannot access secrets.

The Agent’s abilities are stored and enforced on the backend. The frontend provides the management interface, but it is not treated as a security boundary.

## 2. Send the Agent a task

The user selects an Agent in the Playground and sends a prompt.

For example:

```text
Run the project tests and fix any failures.
```

Before the task reaches the Agent Runtime, The Avengers evaluates it:

```text
User prompt
    ↓
Action classification
    ↓
Agent Immune threat detection
    ↓
Risk scoring
    ↓
Ability and policy evaluation
```

The system identifies capabilities that may be required, including:

* Reading workspace files.
* Writing or deleting files.
* Running shell commands.
* Accessing secrets.
* Using the network.
* Joining a shared session.

## 3. The middleware makes a policy decision

The policy layer compares the requested capabilities with the Agent’s permissions and the calculated risk.

The decision rules are:

| Condition                                       | Result                 |
| ----------------------------------------------- | ---------------------- |
| Ability is not granted                          | Denied                 |
| Ability is granted and risk is low or medium    | Allowed                |
| Ability is granted and risk is high or critical | Pending human approval |
| Threat score reaches the blocking threshold     | Automatically blocked  |

For example:

```text
Agent does not have canRunCommand
    ↓
Run is denied
    ↓
Agent Runtime is never called
    ↓
Reason is shown to the user
    ↓
Audit event is recorded
```

The user sees a clear explanation:

```text
Action blocked

This Agent does not have permission to run shell commands.
```

The denial is also saved in the Agent’s conversation history and audit record.

## 4. High-risk actions require human approval

Having an ability does not always mean that an action can execute immediately.

A granted ability gives an Agent permission to request a capability. High-risk and critical actions require a second, explicit human decision for that particular Run.

For example:

```text
Agent has canRunCommand
+ command execution is high risk
→ Run becomes pending_approval
```

The user sees:

```text
Approval required

The Agent wants to run a high-risk command.

[Approve] [Deny]
```

If the user approves the request:

```text
Run continues
→ Agent Runtime executes
→ Approval is recorded
```

If the user denies it:

```text
Run stops
→ Agent does not execute
→ Denial is recorded
```

Changing an Agent’s permissions does not automatically approve an existing pending Run. The user must explicitly approve that specific Run.

## 5. Agent Immune detects suspicious behaviour

Agent Immune analyses prompts for suspicious patterns before they reach the runtime.

It can identify:

* Prompt injection.
* Credential access.
* Sensitive resource access.
* Data exfiltration.
* Suspicious network access.
* Workspace escape.
* Destructive actions.
* Privilege escalation.

The system calculates a risk score between 0 and 100:

| Risk score | Decision            |
| ---------: | ------------------- |
|       0–39 | Allow               |
|      40–79 | Human review        |
|     80–100 | Automatically block |

For example:

```text
Credential request              +25
External data transmission      +20
Suspicious network destination  +12
Credential and exfiltration     +10
Sensitive resource access       +18
------------------------------------------------
Final risk                       85
```

Because the final score is 85, the request is automatically blocked before reaching the Agent Runtime.

## 6. Immune Memory learns from confirmed threats

When a suspicious event is reviewed and confirmed, Agent Immune stores the pattern in Immune Memory.

If a similar prompt appears later, the previous confirmed threat can increase the new risk score:

```text
Static risk       60
Immune Memory    +18
--------------------
Final risk        78
```

Immune Memory is context-aware. A previous approval or rejection can be associated with the relevant Agent, user, or role rather than being applied blindly to everyone.

For example:

```text
Frontend developer requests .env access
→ Tom confirms the request is legitimate
→ approval is remembered for that context

Marketing Agent requests .env access
→ previous frontend approval does not automatically apply
→ human review is required
```

If previous decisions are inconsistent, the system remains uncertain and continues requesting human review instead of learning an unsafe rule.

## 7. Secrets are protected

The redaction layer protects sensitive values before they are persisted or displayed.

Redaction applies to:

* User prompts.
* Agent responses.
* Audit events.
* Error messages.
* Runtime output.
* Tool output.
* API responses.
* Conversation history.

The system detects configured secrets and common credential formats, including API keys, endpoint identifiers, and bearer tokens.

```text
Before:
Authorization: Bearer abc123...

After:
Authorization: [REDACTED]
```

This prevents sensitive values from appearing in the audit table, browser interface, logs, screenshots, or stored Agent history.

## 8. Every important decision is recorded

The audit history provides a permanent explanation of what happened.

An audit event can record:

```text
User
Agent
Run
Session
Action
Risk
Decision
Reason
Prompt
Timestamp
```

For example:

```text
User: user-demo-001
Agent: Testing Agent
Action: canRunCommand
Risk: High
Decision: Pending approval
Reason: High-risk command execution requires human approval
```

The audit view allows users to review:

* Allowed actions.
* Denied actions.
* Pending approvals.
* Human approval decisions.
* Threat detections.
* Secret-redaction events.
* Multi-Agent coordination events.

Single-Agent and Multi-Agent events use the same audit format. Events with a `sessionId` belong to a shared group task, while events without one belong to a standalone Agent Run.

## 9. Alternative flow: Assemble the Avengers as a team

Users can create a group task by mentioning multiple Agents:

```text
@ResearchAgent @CodingAgent @TestingAgent
review this project and propose improvements
```

The `GroupTaskCoordinator` creates a shared session and routes turns between the participating Agents.

```text
User creates group task
    ↓
Mentioned Agents are identified
    ↓
Each Agent’s canJoinSession ability is checked
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
```

Each Agent remains subject to its own ability and policy checks. The coordinator records:

* The participating Agent.
* The human who initiated the task.
* The shared `sessionId`.
* The turn order.
* Each Agent’s contribution.
* Timeouts and failures.
* Duplicate or skipped turns.
* The final group-task status.

A group task may produce:

```text
Turn 1 → Research Agent
Turn 2 → Coding Agent
Turn 3 → Testing Agent
```

The group task completes when an Agent produces the `[TASK COMPLETE]` marker, or fails when the coordinator detects a timeout, duplicate response, skipped turn, or maximum-turn limit.

In this way, the Avengers can collaborate—but every hero still has a defined power set, every action is governed, and every important event leaves a trace.

## Middleware Summary
| Middleware capability | Category | What it does | Main benefit |
|---|---|---|---|
| **Identity and authorisation** | Identity and Policy | Identifies the human user, Agent, or system coordinator responsible for an action. | Provides accountability and prevents actions from being treated as anonymous. |
| **Per-Agent abilities** | Identity and Policy | Gives each Agent a configurable set of abilities, such as reading files, writing files, running commands, accessing secrets, using the network, and joining shared sessions. | Applies least privilege so that each Agent receives only the capabilities it needs. |
| **Policy checker** | Identity and Policy | Compares the abilities requested by a task with the permissions granted to the Agent. | Enforces permissions in the backend rather than relying on frontend controls. |
| **Action classification** | Threat Detection and Safety | Analyses the user’s prompt to estimate which abilities may be required. | Allows the platform to evaluate a task before it reaches the Agent Runtime. |
| **Agent Immune risk scoring** | Threat Detection and Safety | Detects suspicious behaviour, assigns threat signals, and calculates a risk score from 0 to 100. | Distinguishes between ordinary actions, suspicious actions, and severe threats. |
| **Risk-based enforcement** | Threat Detection and Safety | Allows low-risk actions, sends higher-risk actions for review, and automatically blocks actions above the blocking threshold. | Prevents dangerous actions from executing without appropriate oversight. |
| **Human approval workflow** | Identity and Policy | Pauses high-risk permitted Runs until a human explicitly approves or denies the specific Run. | Separates standing Agent permission from one-time approval for risky actions. |
| **Immune Memory** | Threat Detection and Safety | Stores confirmed threat patterns and uses them as additional signals when similar requests appear later. | Allows the system to learn from previous security decisions. |
| **Identity-aware Immune Memory** | Threat Detection and Safety | Associates previous approvals or rejections with relevant users, Agents, or roles instead of applying them universally. | Prevents an approval in one context from automatically authorising a different user or department. |
| **Secret redaction** | Data Protection | Detects known secrets and common credential formats in prompts, responses, errors, tool output, and audit records. | Prevents API keys, tokens, and credentials from appearing in storage, logs, or the UI. |
| **Audit events** | Observability and Governance | Records the user, Agent, Run, session, action, risk, decision, reason, prompt, and timestamp. | Provides a permanent explanation of what happened and why. |
| **Audit history UI** | Observability and Governance | Displays allowed, denied, pending, security, and coordination events. | Turns invisible middleware decisions into visible evidence for users and reviewers. |
| **Multi-Agent coordination** | Coordination | Connects multiple Agents through a shared session and routes turns between them. | Allows Agents to collaborate while preserving shared state and turn order. |
| **Session tracking** | Coordination and Observability | Associates related Multi-Agent Runs and events with a shared `sessionId`. | Makes it possible to reconstruct and inspect an entire group task. |
| **Agent participation control** | Coordination and Identity | Uses `canJoinSession` to control whether an Agent may participate in a shared session. | Prevents unauthorised Agents from joining Multi-Agent tasks. |
| **Turn and failure control** | Coordination and Reliability | Detects duplicate responses, timeouts, skipped turns, and maximum-turn violations. | Prevents group tasks from becoming stuck, inconsistent, or repetitive. |

# Design Summary

The Avengers uses layered enforcement:

```text
Identity and authorisation
    ↓
Per-Agent abilities
    ↓
Threat detection and risk scoring
    ↓
Human approval or automatic blocking
    ↓
Agent Runtime or Multi-Agent coordinator
    ↓
Secret redaction
    ↓
Audit storage and visual evidence
```

The key design principles are:

* **Least privilege:** Agents receive only the capabilities they need.
* **Backend enforcement:** Security decisions are made outside the frontend.
* **Human oversight:** High-risk actions require explicit approval.
* **Context-aware learning:** Immune Memory does not blindly generalise decisions across different users or roles.
* **Explainability:** Users can understand why an action was allowed or blocked.
* **Traceability:** Single-Agent Runs and Multi-Agent Sessions are linked through IDs.
* **Defence in depth:** Abilities, threat scoring, approval, redaction, and audit logging work together.

# Limitations

* The ability catalogue is predefined. Users can manage existing abilities but cannot create arbitrary custom abilities.
* Prompt classification and threat detection are heuristic and may produce false positives or false negatives.
* A prompt classifier cannot guarantee that it predicts every action an Agent may perform.
* Human approval is simplified and does not yet include detailed approval roles, expiry rules, escalation policies, or delegated approval authority.
* Approval is handled at the Run level rather than through a full enterprise approval workflow.
* The current identity system is lightweight and does not represent production-grade authentication.
* Frontend controls are not treated as a security boundary; enforcement occurs in the backend.
* Audit events are stored in a local JSON store and are not immutable, tamper-proof, or designed for high-volume production workloads.
* The audit table only displays events produced by the implemented middleware and may not capture every internal operation performed by the runtime.
* Notifications and audit updates use polling, so the interface may have a short delay before showing new events.
* Secret redaction depends on known secret values and supported credential patterns.
* Immune Memory relies on previously confirmed patterns and does not provide perfect threat intelligence.
* The Multi-Agent coordinator is intentionally lightweight and does not provide a full distributed messaging or scheduling system.
* `canJoinSession` controls participation in the implemented coordinator but does not prevent every possible form of Agent-to-Agent privilege escalation.
* The local container runtime is not a hardened multi-tenant isolation boundary.
* Risk thresholds are prototype rules and are not formally calibrated security guarantees.
