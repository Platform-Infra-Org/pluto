import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { FileFieldComponent } from './FileField';

function apis(presign: unknown, putOk = true) {
  const fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/uploads/presign')) {
      return { ok: true, status: 200, json: async () => presign } as Response;
    }
    return { ok: putOk, status: putOk ? 200 : 403, statusText: 'Forbidden' } as Response;
  });
  // The component's S3 PUT deliberately bypasses fetchApi (see FileField.tsx)
  // and calls the platform `fetch` directly, so it isn't reached by the
  // fetchApiRef mock below — spy on the real global to catch that call too,
  // rather than let it hit the network.
  jest.spyOn(globalThis, 'fetch').mockImplementation(fetch as typeof globalThis.fetch);
  return {
    fetch,
    apis: [
      [discoveryApiRef, { getBaseUrl: async () => 'http://localhost:7007/api/platform-requests' }],
      [fetchApiRef, { fetch }],
    ] as const,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

const FILE = new File(['name: demo'], 'values.yaml', { type: 'text/yaml' });

describe('FileFieldComponent', () => {
  it('uploads the file and stores the s3 url', async () => {
    const onChange = jest.fn();
    const { apis: a } = apis({
      url: 'https://s3.example.com/platform-uploads/scaffolder/ada/u/values.yaml?sig',
      key: 'scaffolder/ada/u/values.yaml',
      bucket: 'platform-uploads',
      expiresIn: 300,
    });
    render(
      <TestApiProvider apis={a as never}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FileFieldComponent {...({ onChange, schema: { title: 'Values' }, uiSchema: {} } as any)} />
      </TestApiProvider>,
    );
    fireEvent.change(screen.getByLabelText(/values/i), { target: { files: [FILE] } });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        's3://platform-uploads/scaffolder/ada/u/values.yaml',
      ),
    );
  });

  it('leaves the value unset and reports when the upload is rejected', async () => {
    const onChange = jest.fn();
    const { apis: a } = apis(
      { url: 'https://s3.example.com/x?sig', key: 'k', expiresIn: 300, bucket: 'b' },
      false,
    );
    render(
      <TestApiProvider apis={a as never}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FileFieldComponent {...({ onChange, schema: { title: 'Values' }, uiSchema: {} } as any)} />
      </TestApiProvider>,
    );
    fireEvent.change(screen.getByLabelText(/values/i), { target: { files: [FILE] } });
    await screen.findByText(/upload failed/i);
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('s3://'));
  });
});
