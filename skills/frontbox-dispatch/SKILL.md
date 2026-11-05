---
name: frontbox-dispatch
description: Check field dispatch safety, reserve standby crews, fail over unaccepted reservations, and verify citizen evidence for FrontBox incidents in Jira Service Management through the FrontBox MCP tools.
allowed-tools: verify-safety-sop-and-parts verify-scene-proof-evidence match-and-reserve-crew trigger-standby-failover
---

# FrontBox Field Dispatch Skill

Use this skill when a human or agent needs to answer one of these questions
about a Jira Service Management incident handled by FrontBox:

- Is this incident safe to dispatch?
- Reserve the nearest qualified crew.
- The primary crew did not accept. Who is next?
- Is the citizen evidence complete and sealed?

## Tools (FrontBox Dispatch MCP Server)

The MCP server key is `frontbox-dispatch-mcp-server`. It exposes four tools.
The same tools back the `frontbox-dispatch-commander` Rovo Agent.

| Tool | Verb | Input | Writes |
| --- | --- | --- | --- |
| `verify-safety-sop-and-parts` | GET | `issueKey` | No |
| `verify-scene-proof-evidence` | GET | `issueKey` | No |
| `match-and-reserve-crew` | TRIGGER | `issueKey`, `commanderApproved` | Yes, gated |
| `trigger-standby-failover` | TRIGGER | `issueKey` | Yes, gated |

## Procedure

1. Always call `verify-safety-sop-and-parts` and
   `verify-scene-proof-evidence` first. Quote `status` and every
   `blockedReasons` or `missing` entry exactly as returned.
2. If either check reports a block, stop. Name the missing part, SOP
   sign-off, certification, or evidence item. Do not offer a workaround
   dispatch.
3. Call `match-and-reserve-crew` only when both checks pass and a human
   commander approved this incident. Set `commanderApproved` to true only
   on explicit human approval in the current conversation.
4. Call `trigger-standby-failover` only for a reserved incident whose
   accept deadline passed. A `NOT_DUE` result means the primary crew
   still owns the job.
5. Report the returned `receiptHash` or `evidenceHash` with every
   conclusion so a dispatcher can audit the decision later.

## Safety rules

- Never invent an asset key, SOP page, crew, part, or hash. If a tool
  returns no data, say which input is missing.
- Vulnerable citizens go first. When comparing incidents, sort by the
  priority lane from FrontBox before distance or arrival order.
- Citizen evidence visible through these tools is already redacted by
  SceneProof. Do not ask the citizen to repeat phone numbers or card
  numbers in chat.

## Example

User: "Can GRID-101 roll?"

1. `verify-safety-sop-and-parts` with `issueKey: GRID-101`.
2. `verify-scene-proof-evidence` with `issueKey: GRID-101`.
3. Answer with both statuses, the matched crew, and the gate receipt.
   Ask for commander approval before any reservation.
