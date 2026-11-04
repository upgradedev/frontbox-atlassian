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
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

// Citizen status view on a submitted portal request. Read-only, plain
// language, spoken-receipt text first for screen reader and voice users.

const App = () => {
  const context = useProductContext();
  const fromContext = context?.extension?.request?.key ?? context?.extension?.issue?.key ?? 'GRID-101';
  const [issueKey, setIssueKey] = useState(fromContext);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      setStatus(await invoke('getCitizenStatus', { issueKey }));
    } catch (err) {
      setError('FrontBox has no status for ' + issueKey + ' yet. If you just submitted, give it a minute and try again.');
    }
  };

  return (
    <Stack space="space.200">
      <Heading size="small">Your help status</Heading>
      <Box>
        <Label labelFor="status-issue">Request key</Label>
        <Textfield id="status-issue" value={issueKey} onChange={(e) => setIssueKey(e.target.value)} />
      </Box>
      <Button appearance="primary" onClick={load}>Show my status</Button>
      {error ? (
        <SectionMessage appearance="warning" title="No status yet">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {status ? (
        <Stack space="space.150">
          <Text>{status.spoken.text}</Text>
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
