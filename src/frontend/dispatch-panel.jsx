import React, { useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Label,
  Lozenge,
  SectionMessage,
  Stack,
  Text,
  Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';

// Standby Roster Auto-Failover panel in the JSM incident view.
// Shows the deterministic gate, priority lane, and crew lease. Every
// disabled action carries its reason beside it (STANDARDS H2).

const App = () => {
  const [issueKey, setIssueKey] = useState('GRID-101');
  const [state, setState] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      setState(await invoke('getDispatchState', { issueKey }));
    } catch (err) {
      setError('FrontBox cannot see incident ' + issueKey + ' yet. Seed the demo workspace or check the key.');
    }
  };

  const seed = async () => {
    const result = await invoke('seedDemo', {});
    await invoke('submitIntake', { issueKey: 'GRID-101', intake: result.sampleIntake });
    setNotice('Demo workspace seeded: ' + result.incidents.join(', ') + '.');
    await load();
  };

  const reserve = async () => {
    try {
      const result = await invoke('approveAndReserve', {
        issueKey,
        commanderApproved: true,
        approvedReceiptHash: state.gate.receiptHash,
      });
      setNotice('Crew ' + result.lease.crewId + ' reserved until ' + result.lease.acceptBy + '.');
      await load();
    } catch (err) {
      setError('Reservation refused by the dispatch gate. Reload the panel and read the blocking reasons.');
    }
  };

  const failover = async () => {
    const result = await invoke('runFailover', { issueKey });
    setNotice(result.reason);
    await load();
  };

  const blocked = state ? !state.gate.allowed : true;

  return (
    <Stack space="space.200">
      <Heading size="small">FrontBox dispatch and standby failover</Heading>
      <Box>
        <Label labelFor="issue">Incident key</Label>
        <Textfield id="issue" value={issueKey} onChange={(e) => setIssueKey(e.target.value)} />
      </Box>
      <Button appearance="primary" onClick={load}>Load dispatch state</Button>
      <Button onClick={seed}>Seed demo workspace (empty site)</Button>
      <Text>Seed writes four synthetic incidents, assets, SOP records, and a standby roster into Forge storage.</Text>
      {error ? (
        <SectionMessage appearance="error" title="Something blocked this">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {notice ? <Text>{notice}</Text> : null}
      {state ? (
        <Stack space="space.150">
          <Text>{state.incident.issueKey}: {state.incident.summary}</Text>
          {state.routing ? (
            <Text>
              Priority <Lozenge appearance={state.routing.lane === 'P0' ? 'removed' : 'inprogress'}>{state.routing.lane}</Lozenge>
              {' '}SLA {state.routing.slaMinutes} minutes. {state.routing.nextAction}
            </Text>
          ) : (
            <Text>No guided intake stored yet. Priority routing runs when the citizen submits the portal form.</Text>
          )}
          <Heading size="xsmall">Safety gate</Heading>
          {state.gate.checks.map((check) => (
            <Text key={check.id}>
              <Lozenge appearance={check.ok ? 'success' : 'removed'}>{check.ok ? 'pass' : 'block'}</Lozenge>
              {' '}{check.label}: {check.detail}
            </Text>
          ))}
          <Text>Gate receipt {state.gate.receiptHash}</Text>
          <Heading size="xsmall">Spoken receipt (Aletheia)</Heading>
          <Text>{state.spoken.text}</Text>
          <Text>Read this aloud, or let a screen reader speak it. The citizen sees the same words on their portal request.</Text>
          <Button appearance="primary" isDisabled={blocked} onClick={reserve}>
            Commander approve and reserve crew
          </Button>
          {blocked ? (
            <Text>Reserve is disabled because the gate blocks this dispatch: {state.gate.blockedReasons.join(' ')}</Text>
          ) : (
            <Text>Approving binds to the gate receipt above. Any changed input needs a new approval.</Text>
          )}
          <Heading size="xsmall">Standby lease</Heading>
          {state.lease ? (
            <Text>Lease {state.lease.leaseId}: crew {state.lease.crewId}, status {state.lease.status}, accept by {state.lease.acceptBy}.</Text>
          ) : (
            <Text>No crew reserved yet.</Text>
          )}
          <Button onClick={failover}>Run standby failover check</Button>
          <Text>Failover also runs every five minutes. An unaccepted lease promotes the next qualified standby crew.</Text>
        </Stack>
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
