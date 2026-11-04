import React, { useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Label,
  SectionMessage,
  Stack,
  Text,
  Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';

// Confluence Post-Incident Evidence Bundle macro. Paste the JSM incident
// key on any post-incident review page to render the sealed bundle.

const App = () => {
  const [issueKey, setIssueKey] = useState('GRID-101');
  const [spaceId, setSpaceId] = useState('');
  const [bundle, setBundle] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      setBundle(await invoke('getEvidenceBundle', { issueKey }));
    } catch (err) {
      setError('No bundle can be built for ' + issueKey + '. The incident must exist in JSM or in the seeded demo workspace.');
    }
  };

  const publish = async () => {
    setError(null);
    try {
      const result = await invoke('publishEvidenceBundle', { issueKey, spaceId });
      setPublishResult(result.page.published
        ? 'Published as Confluence page ' + result.page.pageId + '. Bundle id ' + result.bundleId + '.'
        : 'Not published. ' + result.page.reason);
    } catch (err) {
      setError('Publish failed for ' + issueKey + '. Build the bundle first, then try again.');
    }
  };

  return (
    <Stack space="space.200">
      <Heading size="small">FrontBox post-incident evidence bundle</Heading>
      <Box>
        <Label labelFor="bundle-issue">JSM incident key</Label>
        <Textfield id="bundle-issue" value={issueKey} onChange={(e) => setIssueKey(e.target.value)} />
      </Box>
      <Button appearance="primary" onClick={load}>Build evidence bundle</Button>
      <Box>
        <Label labelFor="bundle-space">Confluence space id for publish (optional if your admin configured one)</Label>
        <Textfield id="bundle-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} />
      </Box>
      <Button onClick={publish}>Publish bundle as a new Confluence page</Button>
      <Text>Without a space id the bundle is kept in Forge storage and the reason is shown here. Nothing is silently dropped.</Text>
      {publishResult ? <Text>{publishResult}</Text> : null}
      {error ? (
        <SectionMessage appearance="error" title="Bundle not built">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {bundle ? (
        <Stack space="space.100">
          <Text>Bundle id {bundle.bundleId}</Text>
          {bundle.markdown.split('\n').map((line, index) => (
            <Text key={String(index)}>{line === '' ? ' ' : line}</Text>
          ))}
        </Stack>
      ) : (
        <Text>No bundle loaded yet. Build one after the dispatch closes, then keep this page as the audit record.</Text>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
