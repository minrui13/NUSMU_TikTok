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
4. [User Flow](#user-flow)
5. [Middleware Directions](#middleware-directions)
6. [Design Summary](#design-summary)

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

This is the problem The Avengers addresses:
We chose to combine identity, per-Agent abilities, risk-based threat detection, human approval, secret redaction, audit logging, and Multi-Agent coordination because no single control is sufficient on its own. Abilities define what an Agent is permitted to do, Agent Immune evaluates how risky the request appears, human approval provides oversight for high-risk actions, redaction protects sensitive information, and audit events make every decision traceable. For Multi-Agent tasks, shared sessions and turn tracking allow users to understand how several Agents collaborated while preserving the same security controls for each Agent.

The key design decision is to enforce these controls at the backend and runtime boundary rather than relying only on frontend restrictions. This ensures that a user or Agent cannot bypass the middleware simply by sending a direct API request.

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

# Middleware Directions
The brief lists five recommended directions in this order. 
This submission covers four of them with real, integrated implementations:

| Direction (brief order)        | Status       | Codebase locations |
|--------------------------------|--------------|-------------------------|
| Identity and Authorization     | Implemented  | `abilities/permissions.ts`, `abilities/policy-checker.ts` |
| Trace, Audit, and Observability| Implemented  | `types/audits.ts`, `AgentService.recordAudit()` |
| Layered Agent Architecture     | Documented   | This document + `AgentService` boundaries |
| Threat Modeling and Safety     | Implemented  | `agent-immune.ts` |
| Multi-Agent Coordination       | Implemented  | `group-task-coordinator.ts`, `mention-parser.ts`, `group-task-service.ts` |


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
