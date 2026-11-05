import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  ButtonGroup,
  Heading,
  Label,
  Lozenge,
  SectionMessage,
  Stack,
  Text,
  Textfield,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

// Standby Roster Auto-Failover panel in the JSM incident view.
// Auto-loads the current Jira issue via useProductContext(), provides a
// 1-click vertical scenario switcher, renders the 5-step user journey,
// and exposes both happy-path crew acceptance and standby auto-failover.

const App = () => {
  const context = useProductContext();
  const liveKey = context?.extension?.issue?.key ?? 'GRID-101';
  const [issueKey, setIssueKey] = useState(liveKey);
  const [state, setState] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const loadForKey = async (targetKey) => {
    const key = targetKey || issueKey;
    setError(null);
    try {
      setState(await invoke('getDispatchState', { issueKey: key }));
    } catch (err) {
      setError('FrontBox cannot see incident ' + key + ' yet. Click Seed demo workspace below to populate all five scenarios.');
    }
  };

  useEffect(() => {
    setIssueKey(liveKey);
    loadForKey(liveKey);
  }, [liveKey]);

  const selectScenario = async (key) => {
    setIssueKey(key);
    setNotice('Switched to scenario ' + key + '.');
    await loadForKey(key);
  };

  const seed = async () => {
    const result = await invoke('seedDemo', {});
    await invoke('submitIntake', { issueKey: 'GRID-101', intake: result.sampleIntake });
    setNotice('Demo workspace seeded: ' + result.incidents.join(', ') + '.');
    await loadForKey(issueKey);
  };

  const reserve = async () => {
    try {
      const result = await invoke('approveAndReserve', {
        issueKey,
        commanderApproved: true,
        approvedReceiptHash: state.gate.receiptHash,
      });
      setNotice('Crew ' + result.lease.crewId + ' reserved until ' + result.lease.acceptBy + '.');
      await loadForKey(issueKey);
    } catch (err) {
      setError('Reservation refused by the dispatch gate. Reload the panel and read the blocking reasons.');
    }
  };

  const accept = async () => {
    try {
      const result = await invoke('acceptLease', { issueKey });
      setNotice('Crew ' + result.lease.crewId + ' accepted dispatch lease ' + result.lease.leaseId + ' within SLA.');
      await loadForKey(issueKey);
    } catch (err) {
      setError('Lease acceptance refused. Reserve a crew first or check if the lease expired.');
    }
  };

  const failover = async () => {
    const result = await invoke('runFailover', { issueKey });
    setNotice(result.reason);
    await loadForKey(issueKey);
  };

  const blocked = state ? !state.gate.allowed : true;
  const hasLease = Boolean(state && state.lease);
  const leaseReserved = Boolean(state && state.lease && state.lease.status === 'RESERVED');

  return (
    <Stack space="space.200">
      <Heading size="small">FrontBox dispatch and standby failover</Heading>
      <Text>
        Journey: <Lozenge appearance={state?.routing ? 'success' : 'default'}>1. Citizen Intake</Lozenge>
        {' '}<Lozenge appearance={state?.gate?.allowed ? 'success' : 'removed'}>2. Teamwork Graph Gate</Lozenge>
        {' '}<Lozenge appearance={hasLease ? 'success' : 'inprogress'}>3. Commander Approval</Lozenge>
        {' '}<Lozenge appearance={state?.lease?.status === 'ACCEPTED' ? 'success' : hasLease ? 'inprogress' : 'default'}>4. Crew Lease / Failover</Lozenge>
        {' '}<Lozenge appearance="new">5. Evidence Bundle</Lozenge>
      </Text>
      <Heading size="xsmall">Quick scenario switcher (1-click judge walkthrough)</Heading>
      <ButtonGroup>
        <Button onClick={() => selectScenario('GRID-101')}>GRID-101 Ready (P0)</Button>
        <Button onClick={() => selectScenario('GRID-103')}>GRID-103 Expired SOP</Button>
        <Button onClick={() => selectScenario('GRID-104')}>GRID-104 Missing Part</Button>
        <Button onClick={() => selectScenario('ROAD-201')}>ROAD-201 Roadside (P0)</Button>
      </ButtonGroup>
      <Box>
        <Label labelFor="issue">Incident key</Label>
        <Textfield id="issue" value={issueKey} onChange={(e) => setIssueKey(e.target.value)} />
      </Box>
      <ButtonGroup>
        <Button appearance="primary" onClick={() => loadForKey(issueKey)}>Load dispatch state</Button>
        <Button onClick={seed}>Seed demo workspace (empty site)</Button>
      </ButtonGroup>
      <Text>Seed writes five synthetic incidents, assets, SOP records, and a standby roster into Forge storage.</Text>
      {error ? (
        <SectionMessage appearance="error" title="Something blocked this">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {notice ? <Text>{notice}</Text> : null}
      {state ? (
        <Stack space="space.150">
          <Text>{state.incident.issueKey}: {state.incident.summary}</Text>
          <Text>
            Teamwork Graph entities: Asset {state.asset ? state.asset.assetKey : 'none'}
            {' '}| SOP {state.sop ? state.sop.pageId : 'none'}
            {' '}| Crew candidate {state.crew ? state.crew.crewId : 'none'}
          </Text>
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
          <Heading size="xsmall">Standby lease and crew response</Heading>
          {state.lease ? (
            <Text>Lease {state.lease.leaseId}: crew {state.lease.crewId}, status {state.lease.status}, accept by {state.lease.acceptBy}.</Text>
          ) : (
            <Text>No crew reserved yet.</Text>
          )}
          <ButtonGroup>
            <Button isDisabled={!leaseReserved} onClick={accept}>Crew accept lease (within SLA)</Button>
            <Button onClick={failover}>Run standby failover check</Button>
          </ButtonGroup>
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
