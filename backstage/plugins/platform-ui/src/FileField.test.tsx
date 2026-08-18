import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { FileFieldComponent } from './FileField';

/**
 * Separate mocks for fetchApi.fetch (presign) and the global fetch (S3 PUT) —
 * NOT the same jest.fn. Sharing one mock between them would prove the data
 * flow but not the separation FileField.tsx exists to guarantee: fetchApi
 * injects a Backstage token, which would leak off-origin and break the
 * signature's header set if it ever reached the PUT. Each mock only knows how
 * to answer its own call, so a regression that routes the PUT through
 * fetchApi (or the presign through the global fetch) fails loudly here
 * instead of silently working because the wrong mock happened to answer.
 */
function apis(presign: unknown, putOk = true) {
  const fetchApiFetch = jest.fn(async (url: string) => {
    if (!String(url).includes('/uploads/presign')) {
      throw new Error(`unexpected fetchApi.fetch call: ${url}`);
    }
    return { ok: true, status: 200, json: async () => presign } as Response;
  });
  const globalFetch = jest.fn(async (url: string) => {
    if (String(url).includes('/uploads/presign')) {
      throw new Error(`presign must go through fetchApi, not the global fetch: ${url}`);
    }
    return { ok: putOk, status: putOk ? 200 : 403, statusText: 'Forbidden' } as Response;
  });
  jest.spyOn(globalThis, 'fetch').mockImplementation(globalFetch as typeof globalThis.fetch);
  return {
    fetchApiFetch,
    globalFetch,
    apis: [
      [discoveryApiRef, { getBaseUrl: async () => 'http://localhost:7007/api/platform-requests' }],
      [fetchApiRef, { fetch: fetchApiFetch }],
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
    const s3Url = 'https://s3.example.com/platform-uploads/scaffolder/ada/u/values.yaml?sig';
    const { apis: a, fetchApiFetch, globalFetch } = apis({
      url: s3Url,
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

    // The separation the field exists to guarantee: presign via fetchApi
    // (authenticated, Backstage token), the S3 PUT via the global fetch
    // (unauthenticated — a Backstage token would leak off-origin and break
    // the signature). Each call went through the right one.
    expect(fetchApiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/uploads/presign'),
      expect.anything(),
    );
    expect(globalFetch).toHaveBeenCalledWith(s3Url, expect.objectContaining({ method: 'PUT' }));
    expect(fetchApiFetch).not.toHaveBeenCalledWith(s3Url, expect.anything());
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
