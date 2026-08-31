# NUSMU 
Members: 
* Goh Min Rui [@minrui13](https://github.com/minrui13)
* Su Myat Myat Htay [@sumyatmyathtay](https://github.com/SuMyatMyatHtay)
* Marcus Yeong Mun Hong [@mxrcxsz12](https://github.com/Mxrcxsz)
* Tham Jodena [@j0-oj](https://github.com/j0-oj)

## Table of Contents
1. [SetUp Instructions](#setup-instructions)
2. [Project Introduction](#project-introduction)
3. [Middleware problem and rationale](#middleware-problem-and-rationale)
4. [Our Solution](#our-solution)
5. [User Flow](#user-flow)
5. [Implemented Middleware](#implemented-middleware)
   - [Abilities and Audit Log](#abilities-and-audit-log)
   - [Immunity System](#immunity-system)
   - [Secret Redaction](#secret-redaction)
   - [Group Task](#group-task)
7. [Architecture and Design Summary](#architecture-and-design-summary)
8. [Architecture](#architecture) 
9. [Individual Demo Steps](#individual-demo-steps)
   - [Abilities and Audit Log](#abilities-and-audit-log)
   - [Immunity System](#immunity-system)
   - [Secret Redaction](#secret-redaction)
   - [Group Task](#group-task)
10. [Limitations](#limitations)
11. [Future Implementations](#future-implementations)

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

# Middleware problem and rationale

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
# Our Solution
The Avengers provides a governance layer for AI Agents that balances capability with control.

Instead of allowing every Agent to act freely, each Agent receives a defined set of abilities. When a user submits a task, the request is evaluated before it reaches the Agent Runtime. The system checks the Agent’s permissions, analyses the request for suspicious behaviour, calculates its risk, and decides whether to allow, deny, automatically block, or hold the Run for human approval.

The user is kept informed throughout the process. Blocked actions include a clear explanation, high-risk actions require explicit approval, and important decisions are preserved in the audit history. Sensitive values are redacted before they can appear in stored Runs, messages, logs, or the frontend.

The same governance model extends to Multi-Agent tasks. When several Agents collaborate through a shared session, each Agent remains subject to its own abilities and policy checks. The coordinator records the participating Agents, turn order, shared session, and any failures.

User
    ↓
Agent or Multi-Agent task
    ↓
Identity and ability checks
    ↓
Threat detection and risk scoring
    ↓
Allow, deny, block, or request approval
    ↓
Agent Runtime or GroupTaskCoordinator
    ↓
Redacted output and audit evidence

This allows the Avengers to work together without giving every Agent unrestricted access. Each Agent has its own powers, risky actions require oversight, and every important decision leaves a trace.

# User Flow

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

# Implemented Middleware

## Abilities and Audit Log
By Goh Min Rui [@minrui13](https://github.com/minrui13)
### Problem
AI Agents can perform powerful actions such as reading workspace files, modifying code, running shell commands, accessing secrets, and using external services. However, not every Agent should have unrestricted access, and not every permitted action should execute automatically.

A simple permission switch is also insufficient on its own. Users need to understand what an Agent attempted, why the action was allowed or blocked, whether human approval was required, and what happened after the decision.

### Solution

The Avengers introduces a unified Agent governance middleware that combines:

* Per-Agent abilities.
* Risk-based policy decisions.
* Human approval for high-risk actions.
* Persistent audit events.

The governance flow is:

```text
User prompt
    ↓
Action classification
    ↓
Agent ability check
    ↓
Risk evaluation
    ↓
Allow, deny, or request approval
    ↓
Agent Runtime
    ↓
Audit record
```

The decision is made by the backend before the request reaches the Agent Runtime. The frontend displays and manages the policy, but it is not trusted to enforce it.

### Per-Agent abilities

Each Agent has its own ability profile. The available abilities include:

| Ability             | Purpose                                              | Risk     |
| ------------------- | ---------------------------------------------------- | -------- |
| `canReadWorkspace`  | Read files in the Agent’s workspace.                 | Low      |
| `canWriteWorkspace` | Create, edit, or delete workspace files.             | Medium   |
| `canRunCommand`     | Run shell commands, tests, builds, or installations. | High     |
| `canAccessSecrets`  | Access credentials, tokens, or secret files.         | Critical |
| `canUseNetwork`     | Connect to external websites or services.            | High     |
| `canJoinSession`    | Participate in a shared Multi-Agent session.         | Medium   |

New Agents receive a least-privilege default profile:

```text
Read workspace files     Enabled
Write workspace files    Enabled
Run shell commands       Disabled
Access secrets           Disabled
Use network              Disabled
Join shared sessions     Disabled
```

Users can manage the abilities of each Agent through the Abilities view. The backend stores the Agent’s current permission profile and uses it during policy evaluation.

### Ability enforcement

When a user submits a prompt, the system classifies the capabilities that may be required.

For example:

```text
Run npm test and fix any failures.
```

may require:

```text
canReadWorkspace
canWriteWorkspace
canRunCommand
```

The policy checker compares these required abilities against the Agent’s granted abilities.

If an ability is missing:

```text
Agent does not have canRunCommand
    ↓
Run is denied
    ↓
Agent Runtime is never called
    ↓
A clear reason is shown to the user
    ↓
The decision is recorded
```

This enforcement occurs in the backend, meaning that bypassing the React interface does not bypass the policy check.

### Risk-based decisions

Having an ability does not always mean that the Agent can act immediately.

The system distinguishes between ordinary actions and high-risk actions:

```text
Ability not granted
    → Denied

Ability granted + low/medium risk
    → Allowed

Ability granted + high/critical risk
    → Pending human approval
```

For example:

```text
Agent has canRunCommand
+ command execution is high risk
→ Run becomes pending_approval
```

The Run remains paused until a human explicitly approves or denies that particular Run.

Changing an Agent’s permissions does not automatically approve an existing pending Run.

### Human approval

High-risk actions produce a `pending_approval` Run rather than immediately reaching the Agent Runtime.

The user can review:

```text
Agent
Requested action
Original prompt
Risk level
Reason for review
```

The user can then:

```text
Approve
→ Run continues and reaches the Agent Runtime

Deny
→ Run is stopped and marked as denied
```

Both decisions are added to the audit history.

This creates two separate controls:

```text
Agent ability
→ standing permission to request a capability

Human approval
→ one-time permission for a specific high-risk Run
```

### Audit logging

Every important policy and approval decision is written to the audit log.

The shared audit function is implemented in:

```text
apps/server/src/agent-service.ts
```

It records events to the existing JSON store:

```text
apps/server/src/store.ts
```

Each audit event can contain:

```text
User ID
Agent ID
Run ID
Session ID
Actor
Action
Risk
Decision
Reason
Prompt
Timestamp
```

Examples of recorded events include:

```text
canRunCommand → pending_approval
canAccessSecrets → denied
approve_run → allowed
deny_run → denied
grant_canUseNetwork → allowed
```

The audit history is displayed through the Audit view, allowing users to inspect both successful and unsuccessful decisions.

### Persistent conversation evidence

When a Run is denied or fails because of a policy decision, the system also stores a system message in the Agent’s conversation history.

This means that the result remains visible after the user navigates away and returns:

```text
User:
Read the .env file.

Policy System:
Run denied: canAccessSecrets is not granted to this Agent.
```

Temporary notifications provide immediate feedback, while the stored system message and audit event provide lasting evidence.

### Implementation boundaries

The main implementation is distributed across these backend areas:

```text
apps/server/src/middleware/permissions.ts
→ Ability definitions and risk levels

apps/server/src/middleware/policy-checker.ts
→ Ability evaluation and policy decisions

apps/server/src/agent-service.ts
→ Enforcement before Agent execution, approval handling, and audit recording

apps/server/src/types.ts
→ Agent, Run, ability, and audit-event contracts

apps/server/src/store.ts
→ Persistent JSON storage for Agents, Runs, and audit events

apps/server/src/app.ts
→ API routes for updating abilities, reading audit events, and approving Runs
```

Together, these components turn Agent permissions from a frontend setting into a backend-enforced governance system.

## Immunity System 
By Su Myat Myat Htay [@sumyatmyathtay](https://github.com/SuMyatMyatHtay)
## Secret Redaction 
By Tham Jodena [@j0-oj](https://github.com/j0-oj)
### Problem
Agent-generated content can accidentally contain sensitive information such as API keys, authentication tokens, or endpoint credentials. This information may appear in prompts, Agent responses, error messages, Runtime output, audit records, or API responses.

If sensitive values are persisted or returned to the frontend, they may be exposed through the conversation history, logs, screenshots, browser tools, or stored JSON data.

### Solution

The Avengers includes a shared, stateless redaction utility located at:

```text
apps/server/src/utils/redaction.ts
```

The utility is applied at storage and response boundaries, before Agent-derived or error-related data becomes persisted or externally visible.

It protects configured secrets such as:

```text
ARK_API_KEY
APP_AUTH_TOKEN
```

It also detects common secret-shaped values, including:

```text
sk-...
ep-...
Bearer ...
```

### How it works

`getKnownSecrets()` reads the current values of configured secret environment variables at call time. This means callers do not need to receive or manually handle the raw secret values.

`redactSecrets()` recursively processes:

* Strings.
* Arrays.
* Nested objects.

Known secret values are removed from strings using exact, case-sensitive matching. Generic secret patterns are then removed in a second pass to catch credential-shaped values whose literal secret is not available to the application.

Non-string values such as numbers, booleans, `null`, and `undefined` pass through unchanged.

The function returns a new value rather than mutating the original input. This prevents callers from accidentally changing or exposing the original object through shared references.

Empty or unset environment variables are ignored so that an empty secret cannot accidentally match and remove all output.

### Integration points

Redaction is applied at two main boundaries.

#### Run output and error persistence

In:

```text
apps/server/src/agent-service.ts
```

Agent output is redacted before it is written to:

* `AgentRun.output`.
* Persisted assistant messages.
* `Agent.lastError`.
* `AgentRun.error`.

This ensures that raw Agent Runtime output is never written directly to the JSON store.

#### Global API error handling

In:

```text
apps/server/src/app.ts
```

The global error handler redacts error messages before they are:

* Returned in API responses.
* Written to server logs.
* Included in redacted stack-trace output.

This protects both client-visible errors and server-side logs from accidental credential leakage.

### Result

The redaction layer provides defence in depth by protecting sensitive values at the point where they leave the Runtime or application boundary.

```text
Agent output or error
    ↓
Secret redaction
    ↓
JSON storage, API response, or server log
```

As a result, users can inspect Agent history and audit evidence without exposing configured credentials or common credential-shaped values.


## Group Task 
By Marcus Yeong Mun Hong [@mxrcxsz12](https://github.com/Mxrcxsz)
### Problem

A single Agent can work independently, but some tasks benefit from multiple specialised Agents collaborating together. Without a coordination layer, Agents may not share context, respond in an unpredictable order, repeat previous work, or leave the task running indefinitely.

Users also need to understand:

* Which Agents are participating.
* Which Agent is currently acting.
* What each Agent contributed.
* How the shared task is progressing.
* Whether an Agent timed out or repeated an earlier response.
* Whether the group task completed successfully.

### Solution

The Avengers introduces a lightweight group-chat style coordination middleware.

A user creates a group task by writing a prompt and mentioning the Agents they want to involve:

```text
@ResearchAgent @CodingAgent @TestingAgent
review this project and propose improvements
```

The `GroupTaskService` identifies the mentioned Agents and creates a `GroupTaskCoordinator`. The coordinator creates a shared session, assigns the participating Agents a turn order, and routes the task between them.

The main implementation is located in:

```text
apps/server/src/group-task-service.ts
apps/server/src/group-task-coordinator.ts
```

The feature is exposed through the group-task API routes and a frontend panel that displays the live turn history.

### How it works

```text
User creates a group task
    ↓
Agents are identified from @mentions
    ↓
A shared session is created
    ↓
The coordinator selects the next Agent
    ↓
The Agent receives the original task and shared history
    ↓
The Agent produces one contribution
    ↓
The contribution is recorded
    ↓
The next Agent continues
```

Each Agent receives the conversation history so that it can build on previous contributions rather than working in isolation.

The coordinator uses a fixed round-robin order based on the order in which Agents were mentioned:

```text
Turn 1 → Research Agent
Turn 2 → Coding Agent
Turn 3 → Testing Agent
Turn 4 → Research Agent
```

The shared `sessionId` connects all Runs and coordination events belonging to the same group task.

### Shared state

The coordinator maintains the state of the group task, including:

* The task description.
* The participating Agents.
* The shared session ID.
* The ordered list of turns.
* The current task status.
* Errors and completion time.
* The maximum number of allowed turns.

Each turn records:

```text
Turn ID
Agent ID
Agent name
Contribution
Timestamp
```

This allows the frontend to display a live, readable history of the group conversation.

### Completion and failure handling

The group task completes when an Agent ends its response with:

```text
[TASK COMPLETE]
```

The coordinator also prevents the task from continuing indefinitely by enforcing:

* A maximum number of turns.
* A per-turn timeout.
* Duplicate-response detection.
* Failure handling when an Agent does not complete successfully.

For example:

```text
Agent does not respond in time
    → group task fails with a timeout reason

Agent repeats an earlier contribution
    → group task fails as a duplicate-turn anomaly

Agent produces [TASK COMPLETE]
    → group task is marked completed
```

### Integration with governance middleware

Multi-Agent coordination uses the same Agent governance layer as a normal Run.

Before an Agent participates:

```text
Coordinator selects Agent
    ↓
canJoinSession ability is checked
    ↓
Agent is allowed or rejected
    ↓
Coordination event is recorded
```

Each Agent’s subsequent Run is also subject to its own ability and policy checks. This prevents the shared session from bypassing individual Agent permissions.

Coordination events are written using the shared audit mechanism and include the relevant:

```text
User ID
Agent ID
Run ID
Session ID
Action
Decision
Reason
Timestamp
```

This allows users to inspect both individual Agent actions and the complete Multi-Agent session in the audit interface.

### Verification

The coordination logic was tested with a stubbed Agent Runner so that tests do not require model tokens or external API calls.

The tests cover:

* A normal countdown-style group task completing successfully.
* Agents taking turns in the expected order.
* Shared conversation history being passed between turns.
* Duplicate-turn detection.
* Stuck-Agent or timeout failure handling.
* Maximum-turn protection.

This demonstrates that the coordination layer can route turns and maintain shared state independently of the model provider.


# Architecture and Design Summary


## Design Summary
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

# Demo Steps
## Abilities and Audit Log
By Goh Min Rui [@minrui13](https://github.com/minrui13)

## Immunity System 
By Su Myat Myat Htay [@sumyatmyathtay](https://github.com/SuMyatMyatHtay)
## Secret Redaction 
By Tham Jodena [@j0-oj](https://github.com/j0-oj)

## Group Task 
By Marcus Yeong Mun Hong [@mxrcxsz12](https://github.com/Mxrcxsz)
Built a group-chat style middleware where a user writes a task and @mentions which Agents to include. A GroupTaskCoordinator round-robins turns between them in mention order, feeding each Agent the full shared conversation history so they build on each other's turns, until one signals [TASK COMPLETE]. Wired into the platform via new /api/group-tasks routes and a UI panel showing a live turn feed. Tested with a stubbed runner (zero-token unit tests) covering the normal countdown-to-completion case and a stuck/duplicate-turn failure case.  
1. Click 'Group Task' on the sidebar
<img width="960" height="500" alt="image" src="https://github.com/user-attachments/assets/7774db4f-2a3b-4c72-84b0-e3c476a0f6a6" />

2. In the 'Group Task' dialog, write a task description and tag the group of available agents  with "@" (only agents with ```canJoinSession``` ability can participate)
<img width="960" height="498" alt="Screenshot 2026-08-31 212552" src="https://github.com/user-attachments/assets/e9340e4b-640d-441c-a150-3301f2617341" />

3. After starting group task, the group task will run and the dialog will log the group task activity. 
Once the group task status becomes "completed", the group task is done. 
<img width="960" height="500" alt="image" src="https://github.com/user-attachments/assets/5eb18c6b-3889-449c-8030-8e90746506bc" />

> The individual activity of each agent can be viewed in their relative playground view.
<img width="960" height="498" alt="image" src="https://github.com/user-attachments/assets/fb830918-7040-4465-9c7d-62d24af5839e" />




# Limitations

* **Heuristic prompt classification:** The ability classifier uses keyword and pattern matching to estimate which capabilities a prompt may require. It may under-classify or over-classify ambiguous prompts.

* **Heuristic Immune Engine detection:** The Immune Engine relies on configured regex patterns, known threat indicators, weighted signals, and previously confirmed patterns. It targets observed failure modes but cannot guarantee detection of every adversarial, malformed, or novel input. It may also produce false positives or false negatives.

* **Limited Immune Memory:** Immune Memory is based on previously confirmed threat patterns and does not provide complete or continuously updated threat intelligence. New attack techniques may not be recognised until their patterns are added or confirmed.

* **Simplified risk thresholds:** The 0–100 risk score and its allow, review, and block thresholds are prototype rules. They have not been formally calibrated against a large real-world dataset and should not be treated as guaranteed security boundaries.

* **Simplified human approval:** Approval is handled at the individual Run level. The prototype does not yet include detailed approval roles, approval expiry, escalation policies, or delegated approval authority.

* **Lightweight identity model:** The current prototype uses a demo or lightweight `userId` rather than production-grade authentication. A production system would need secure sessions, user ownership, role-based access control, and stronger authorisation checks.

* **Limited audit guarantees:** Audit events are stored in the local JSON store. They are not immutable, tamper-proof, or designed for high-volume production workloads. The audit table only displays events captured by the implemented middleware and may not represent every internal runtime operation.

* **Secret-redaction coverage:** Redaction depends on known secret values and supported credential patterns. It may not detect every possible secret format or sensitive value. Redaction also cannot protect a secret that was already exposed before reaching the redaction layer.

* **Lightweight Multi-Agent coordination:** Group-task state is held in memory for the current server process and does not survive a server restart. Agent turns use fixed round-robin ordering, and the coordinator does not provide a full distributed messaging or scheduling system.

* **Coordination and privilege boundaries:** `canJoinSession` controls participation in the implemented group-task coordinator, but it does not prevent every possible form of Agent-to-Agent privilege escalation or confused delegation.

* **Notification delay:** Approval and audit updates use polling, so notifications and status changes may take a few seconds to appear in the frontend.

* **Runtime isolation:** The local container runtime is suitable for demonstrating the middleware but is not a hardened multi-tenant security boundary.

* **Local data persistence:** Agent, Run, and audit data use local JSON persistence, while in-memory group-task state is lost when the server process stops. A production deployment would require a transactional database and durable coordination state.

# Future Implementations

The Avengers currently provides a focused proof of concept. The following improvements could extend the middleware towards a production-ready Agent platform.

| Category              | Future Work                                                                 | Why it Matters                                                                 |
|-----------------------|------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| **Identity**          | Replace the `X-User-Id` header with real authentication and sessions         | Right now identity is self-declared and trivially spoofable — production use needs real login |
| **Trace/Audit**       | Move the JSON store to a real database with append-only, tamper-evident audit storage | A single JSON file isn't safe for concurrent writes or trustworthy long-term evidence |
| **Threat Modeling**   | Replace keyword-based action classification with Runtime-level enforcement   | An Agent could phrase a risky request in words the classifier doesn't recognize and slip past the policy check |
| **Multi-Agent Coordination** | Persist session/group-task state so it survives a server restart       | Right now a coordination session lives in memory and would be lost if the server crashed mid-countdown |
| **Multi-Agent Coordination** | Add participant approval so only authorized Agents can join a shared session | Prevents an unrelated Agent from joining or reading someone else's coordination session |
| **UX/Governance**     | Replace polling with real-time push (SSE/WebSockets) for approvals and audit updates | Removes the 3-second notification delay and the constant background polling |

These future improvements would extend The Avengers from a local hackathon prototype into a more durable, scalable, and production-oriented governance layer. They are deliberately separated from the current implementation so that the scope and limitations of the prototype remain clear.
