import React, { useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Heading,
  Label,
  Lozenge,
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
// Includes 1-click vertical presets, a 3-step self-explaining citizen
// journey, automatic PII redaction before storage, and Volcan/Vesta P0
// vulnerable citizen priority routing.

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

  const applyPreset = (kind) => {
    setError(null);
    if (kind === 'grid') {
      setScenario({ value: 'utility-grid' });
      setLocation('Substation 14, Pole 14B, North Sector');
      setDescription('Transformer bay arcing, contact Nikos at +30 694 555 0199 or nikos@example.gr.');
      setVoiceTranscript('Sparks on pole 14B, oxygen concentrator running on backup battery.');
      setPhotoCount('2');
      setHazardClass({ value: 'high-voltage' });
      setContactChannel('voice-callback');
      setElderly(true);
      setDisability(false);
      setMedical(true);
    } else if (kind === 'road') {
      setScenario({ value: 'roadside-assist' });
      setLocation('Highway Corridor KM 42 Eastbound shoulder');
      setDescription('Two-vehicle collision, plate ZXK-9081, call +30 697 111 2233.');
      setVoiceTranscript('Wheelchair passenger waiting in vehicle on highway shoulder.');
      setPhotoCount('3');
      setHazardClass({ value: 'collision' });
      setContactChannel('sms');
      setElderly(true);
      setDisability(true);
      setMedical(false);
    } else {
      setScenario({ value: 'insurance-claims' });
      setLocation('Ground floor apartment, Ermou 42');
      setDescription('Basement main pipe burst flooding electrical panel, phone +30 210 555 0144.');
      setVoiceTranscript('');
      setPhotoCount('2');
      setHazardClass({ value: 'flooding' });
      setContactChannel('sms');
      setElderly(false);
      setDisability(false);
      setMedical(false);
    }
  };

  const submit = async () => {
    setError(null);
    const intake = {
      scenario: scenario.value,
      location,
      description,
      voiceTranscript,
      photoCount: Number.parseInt(photoCount, 10) || 0,
      hasSceneDiagram: scenario.value === 'roadside-assist',
      hazardClass: hazardClass.value,
      contactChannel,
      vulnerable: { elderly, disability, medicalDependency: medical },
      capturedAt: new Date().toISOString(),
    };
    try {
      const response = await invoke('submitIntake', { issueKey: draftKey, intake });
      setResult(response);
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
      <Text>
        Citizen journey: <Lozenge appearance="inprogress">1. Choose vertical or preset</Lozenge>
        {' '}<Lozenge appearance="new">2. Auto-redact PII (SceneProof)</Lozenge>
        {' '}<Lozenge appearance={result?.lane === 'P0' ? 'removed' : 'success'}>3. ClaimReady and Priority SLA</Lozenge>
      </Text>
      <Text>Answer what you can. FrontBox redacts personal phone numbers, emails, and plates before storage, checks completeness, and routes vulnerable citizens first.</Text>
      <Heading size="xsmall">Quick fill vertical presets (1-click demo)</Heading>
      <ButtonGroup>
        <Button onClick={() => applyPreset('grid')}>Power Grid Outage (P0)</Button>
        <Button onClick={() => applyPreset('road')}>Roadside Collision (P0)</Button>
        <Button onClick={() => applyPreset('claims')}>Property Flooding (P1)</Button>
      </ButtonGroup>
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
          <Text>SceneProof privacy: {Array.isArray(result.redactions) ? result.redactions.length : 0} PII items redacted before storage.</Text>
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
