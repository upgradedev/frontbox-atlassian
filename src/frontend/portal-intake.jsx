import React, { useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Checkbox,
  Heading,
  Label,
  Option,
  SectionMessage,
  Select,
  Stack,
  Text,
  TextArea,
  Textfield,
} from '@forge/react';
import { invoke, view } from '@forge/bridge';

// JSM Customer Portal Guided SceneProof and ClaimReady Intake.
// Citizens get one short guided form. Voice transcript paste covers the
// Volcan accessible channel; vulnerable flags drive priority routing.

const App = () => {
  const [scenario, setScenario] = useState({ value: 'utility-grid' });
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [photoCount, setPhotoCount] = useState('0');
  const [hazardClass, setHazardClass] = useState({ value: 'outage' });
  const [contactChannel, setContactChannel] = useState('');
  const [elderly, setElderly] = useState(false);
  const [disability, setDisability] = useState(false);
  const [medical, setMedical] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [draftKey] = useState('DRAFT-' + Date.now());

  const submit = async () => {
    setError(null);
    const intake = {
      scenario: scenario.value,
      location,
      description,
      voiceTranscript,
      photoCount: Number.parseInt(photoCount, 10) || 0,
      hasSceneDiagram: false,
      hazardClass: hazardClass.value,
      contactChannel,
      vulnerable: { elderly, disability, medicalDependency: medical },
      capturedAt: new Date().toISOString(),
    };
    try {
      const response = await invoke('submitIntake', { issueKey: draftKey, intake });
      setResult(response);
      // Best effort: attach the draft link to the created request. The
      // sealed intake is already stored by invoke, so a submit failure
      // here must not lose the citizen report.
      try {
        await view.submit({
          fields: [
            { key: 'frontboxDraftKey', value: draftKey },
            { key: 'frontboxLane', value: response.lane },
            { key: 'frontboxEvidenceHash', value: response.evidenceHash },
          ],
          isValid: true,
        });
      } catch {
        // Intake remains stored under the draft key for dispatcher pickup.
      }
    } catch (err) {
      setError('Intake could not be saved. Your request text is still in the form. Try again or call the service desk.');
    }
  };

  return (
    <Stack space="space.200">
      <Heading size="small">FrontBox guided incident intake</Heading>
      <Text>Answer what you can. FrontBox checks completeness before a crew is sent, and people who need help most are routed first.</Text>
      <Box>
        <Label labelFor="scenario">What happened?</Label>
        <Select id="scenario" value={scenario} onChange={setScenario}>
          <Option label="Power or water outage" value="utility-grid" />
          <Option label="Roadside collision or breakdown" value="roadside-assist" />
          <Option label="Property damage" value="insurance-claims" />
        </Select>
      </Box>
      <Box>
        <Label labelFor="location">Where is it? Street, pole number, or landmark.</Label>
        <Textfield id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </Box>
      <Box>
        <Label labelFor="description">Describe what you see.</Label>
        <TextArea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Box>
      <Box>
        <Label labelFor="voice">Used voice dictation? Paste the transcript here.</Label>
        <TextArea id="voice" value={voiceTranscript} onChange={(e) => setVoiceTranscript(e.target.value)} />
      </Box>
      <Box>
        <Label labelFor="photos">How many photos did you attach to this request?</Label>
        <Textfield id="photos" value={photoCount} onChange={(e) => setPhotoCount(e.target.value)} />
      </Box>
      <Box>
        <Label labelFor="hazard">Closest hazard</Label>
        <Select id="hazard" value={hazardClass} onChange={setHazardClass}>
          <Option label="Outage, no visible damage" value="outage" />
          <Option label="Sparks, hum, or fallen power line" value="high-voltage" />
          <Option label="Vehicle collision" value="collision" />
          <Option label="Flooding" value="flooding" />
          <Option label="Fire or smoke" value="fire" />
          <Option label="Vehicle breakdown" value="breakdown" />
          <Option label="Property damage" value="property-damage" />
        </Select>
      </Box>
      <Box>
        <Label labelFor="contact">How do we reach you? For example: sms, voice-callback.</Label>
        <Textfield id="contact" value={contactChannel} onChange={(e) => setContactChannel(e.target.value)} />
      </Box>
      <Checkbox label="I am elderly or reporting for an elderly person" isChecked={elderly} onChange={(e) => setElderly(e.target.checked)} />
      <Checkbox label="Disability affects waiting or evacuation" isChecked={disability} onChange={(e) => setDisability(e.target.checked)} />
      <Checkbox label="Powered medical care or refrigerated medicine at this address" isChecked={medical} onChange={(e) => setMedical(e.target.checked)} />
      <Button appearance="primary" onClick={submit}>Check my report with FrontBox</Button>
      {error ? (
        <SectionMessage appearance="error" title="Not saved">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {result ? (
        <SectionMessage appearance={result.ready ? 'success' : 'warning'} title={result.ready ? 'Report is dispatch-ready' : 'Report needs a little more'}>
          <Text>Priority lane {result.lane}. Target response {result.slaMinutes} minutes. {result.nextAction}</Text>
          {result.missing.map((item) => (
            <Text key={item}>Still needed: {item}</Text>
          ))}
          <Text>Evidence seal {result.evidenceHash}</Text>
        </SectionMessage>
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
