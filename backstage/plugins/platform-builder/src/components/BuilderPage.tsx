import { useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  InfoCard,
  Link,
  Page,
} from '@backstage/core-components';
import {
  Button,
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import {
  builderApiRef,
  PublishResult,
  RequestField,
} from '../api';

const TYPES = ['string', 'number', 'boolean', 'enum'] as const;

export function BuilderPage() {
  const api = useApi(builderApiRef);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<RequestField[]>([
    { name: 'region', title: 'Region', type: 'string', required: true },
  ]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult>();
  const [error, setError] = useState<string>();

  const setField = (i: number, patch: Partial<RequestField>) =>
    setFields(fs => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const addField = () =>
    setFields(fs => [...fs, { name: '', type: 'string' }]);
  const removeField = (i: number) =>
    setFields(fs => fs.filter((_, j) => j !== i));

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const res = await api.createDefinition({
        name: name.trim(),
        title: title.trim() || name.trim(),
        fields: fields
          .filter(f => f.name.trim())
          .map(f => ({
            ...f,
            enum:
              f.type === 'enum' && f.enum
                ? f.enum
                : undefined,
          })),
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page themeId="tool">
      <Header
        title="Service Builder"
        subtitle="Author a resource type — publishes a software template + Argo workflow"
      />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <InfoCard title="New resource type">
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Type id (e.g. cache)"
                    fullWidth
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Title"
                    fullWidth
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" style={{ marginTop: 20 }}>
                Request fields
              </Typography>
              {fields.map((f, i) => (
                <Grid container spacing={1} key={i} alignItems="center">
                  <Grid item xs={4}>
                    <TextField
                      label="name"
                      fullWidth
                      value={f.name}
                      onChange={e => setField(i, { name: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      select
                      label="type"
                      fullWidth
                      value={f.type}
                      onChange={e =>
                        setField(i, { type: e.target.value as RequestField['type'] })
                      }
                    >
                      {TYPES.map(t => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={3}>
                    {f.type === 'enum' && (
                      <TextField
                        label="values (csv)"
                        fullWidth
                        value={(f.enum ?? []).join(',')}
                        onChange={e =>
                          setField(i, {
                            enum: e.target.value
                              .split(',')
                              .map(s => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    )}
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton
                      aria-label="remove field"
                      onClick={() => removeField(i)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={addField}
                size="small"
                style={{ marginTop: 8 }}
              >
                Add field
              </Button>

              <div style={{ marginTop: 20 }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={busy || !name.trim()}
                  onClick={submit}
                >
                  Publish type
                </Button>
              </div>
              {error && (
                <Typography color="error" style={{ marginTop: 12 }}>
                  {error}
                </Typography>
              )}
            </InfoCard>
          </Grid>

          <Grid item xs={12} md={5}>
            <InfoCard title="Result">
              {!result && !error && (
                <Typography variant="body2" color="textSecondary">
                  Publishing generates a Scaffolder template + an Argo
                  WorkflowTemplate and makes the type requestable.
                </Typography>
              )}
              {result && (
                <>
                  <Typography>
                    Published <b>{result.name}</b> — now requestable.
                  </Typography>
                  <Typography variant="body2" style={{ marginTop: 8 }}>
                    Template: <code>{result.templatePath}</code>
                  </Typography>
                  <Typography style={{ marginTop: 12 }}>
                    <Link to="/create">Go to Create →</Link>
                  </Typography>
                </>
              )}
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
