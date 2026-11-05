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

// Citizen status view on a submitted portal request. Auto-loads on open,
// uses plain language, puts spoken-receipt text first for screen reader
// and voice users, and never exposes internal crew IDs or gate hashes.

const App = () => {
  const context = useProductContext();
  const fromContext = context?.extension?.request?.key ?? context?.extension?.issue?.key ?? 'GRID-101';
  const [issueKey, setIssueKey] = useState(fromContext);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const loadForKey = async (targetKey) => {
    const key = targetKey || issueKey;
    setError(null);
    try {
      setStatus(await invoke('getCitizenStatus', { issueKey: key }));
    } catch (err) {
      setError('FrontBox has no status for ' + key + ' yet. If you just submitted, give it a minute and try again.');
    }
  };

  useEffect(() => {
    setIssueKey(fromContext);
    loadForKey(fromContext);
  }, [fromContext]);

  const switchRequest = async (key) => {
    setIssueKey(key);
    await loadForKey(key);
  };

  return (
    <Stack space="space.200">
      <Heading size="small">Your help status</Heading>
      <ButtonGroup>
        <Button onClick={() => switchRequest('GRID-101')}>GRID-101 (P0)</Button>
        <Button onClick={() => switchRequest('GRID-103')}>GRID-103 (SOP Blocked)</Button>
        <Button onClick={() => switchRequest('GRID-104')}>GRID-104 (Part Blocked)</Button>
        <Button onClick={() => switchRequest('ROAD-201')}>ROAD-201 (Roadside P0)</Button>
      </ButtonGroup>
      <Box>
        <Label labelFor="status-issue">Request key</Label>
        <Textfield id="status-issue" value={issueKey} onChange={(e) => setIssueKey(e.target.value)} />
      </Box>
      <Button appearance="primary" onClick={() => loadForKey(issueKey)}>Show my status</Button>
      {error ? (
        <SectionMessage appearance="warning" title="No status yet">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {status ? (
        <Stack space="space.150">
          <Heading size="xsmall">Spoken status receipt (Aletheia screen-reader and voice format)</Heading>
          <Text>{status.spoken.text}</Text>
          <Text>Voice SSML markup: {status.spoken.ssml}</Text>
          <Text>
            Priority {status.lane ? <Lozenge appearance={status.lane === 'P0' ? 'removed' : 'inprogress'}>{status.lane}</Lozenge> : 'not assigned yet'}
            {status.slaMinutes ? ' Target response ' + status.slaMinutes + ' minutes.' : ''}
          </Text>
          <Text>{status.statusLine}</Text>
          <Text>{status.crewStatus}</Text>
          <Text>Next step: {status.nextAction}</Text>
          {status.missing.map((item) => (
            <Text key={item}>Still needed from you: {item}</Text>
          ))}
          {status.evidenceHash ? <Text>Your evidence seal: {status.evidenceHash}</Text> : null}
        </Stack>
      ) : (
        <Text>Press Show my status. You will see your priority, what happens next, and anything still needed from you.</Text>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
