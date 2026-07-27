import { LoggerService } from '@backstage/backend-plugin-api';
import { parse, stringify } from 'yaml';

export interface CatalogWriterConfig {
  giteaBaseUrl: string;
  user: string;
  password: string;
  owner: string;
  repo: string;
}

interface GiteaContent {
  content?: string;
  sha?: string;
}

/**
 * Applies a request's result to the catalog repo once its workflow succeeds:
 * UPDATE rewrites the resource entity's spec, DELETE removes its file + Location
 * target. (For the local demo the backend applies this; in production the Argo
 * workflow would mutate the repo — design decision #9.)
 */
export class CatalogWriter {
  constructor(
    private readonly cfg: CatalogWriterConfig,
    private readonly logger: LoggerService,
  ) {}

  private url(path: string): string {
    const { giteaBaseUrl, owner, repo } = this.cfg;
    return `${giteaBaseUrl}/api/v1/repos/${owner}/${repo}/contents/${path}`;
  }

  private get headers(): Record<string, string> {
    const basic = Buffer.from(`${this.cfg.user}:${this.cfg.password}`).toString(
      'base64',
    );
    return { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' };
  }

  private async getFile(path: string): Promise<GiteaContent | undefined> {
    const res = await fetch(this.url(path), { headers: this.headers });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`gitea GET ${path}: ${res.status}`);
    return (await res.json()) as GiteaContent;
  }

  private async putFile(
    path: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<void> {
    const res = await fetch(this.url(path), {
      method: sha ? 'PUT' : 'POST',
      headers: this.headers,
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: 'main',
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) throw new Error(`gitea write ${path}: ${res.status} ${await res.text()}`);
  }

  /**
   * Apply the request params to the resource's data, at the same source the
   * edit dialog read them from: the `platform.io/resource-data` annotation if
   * present, else `spec.resourceData` (its nested `.spec` for the envelope
   * shape, else the object itself).
   */
  async updateResource(
    name: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    const path = `resources/${name}.yaml`;
    const f = await this.getFile(path);
    if (!f?.content) return;
    const doc = parse(Buffer.from(f.content, 'base64').toString('utf8'));
    const entries = Object.entries(params ?? {});

    const ann = doc.metadata?.annotations?.['platform.io/resource-data'];
    if (ann !== undefined) {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(ann) || {};
      } catch {
        data = {};
      }
      for (const [k, v] of entries) data[k] = v;
      doc.metadata.annotations['platform.io/resource-data'] =
        JSON.stringify(data);
    } else {
      doc.spec ??= {};
      doc.spec.resourceData ??= {};
      const rd = doc.spec.resourceData;
      const target =
        rd.spec && typeof rd.spec === 'object' && !Array.isArray(rd.spec)
          ? rd.spec // envelope shape
          : rd; // flat
      for (const [k, v] of entries) target[k] = v;
    }

    await this.putFile(path, stringify(doc), `update ${name}`, f.sha);
    this.logger.info(`catalog: updated resource ${name}`);
  }

  /** Remove the resource entity's file and its Location target. */
  async deleteResource(name: string): Promise<void> {
    const path = `resources/${name}.yaml`;
    const f = await this.getFile(path);
    if (f?.sha) {
      const res = await fetch(this.url(path), {
        method: 'DELETE',
        headers: this.headers,
        body: JSON.stringify({ message: `delete ${name}`, sha: f.sha, branch: 'main' }),
      });
      if (!res.ok) throw new Error(`gitea DELETE ${path}: ${res.status}`);
    }
    await this.removeLocationTarget(name);
    this.logger.info(`catalog: deleted resource ${name}`);
  }

  private async removeLocationTarget(name: string): Promise<void> {
    const path = 'catalog-info.yaml';
    const f = await this.getFile(path);
    if (!f?.content) return;
    const current = Buffer.from(f.content, 'base64').toString('utf8');
    const target = `./resources/${name}.yaml`;
    const next = current
      .split('\n')
      .filter(l => !l.includes(target))
      .join('\n');
    if (next !== current) {
      await this.putFile(path, next, `chore: unregister ${name}`, f.sha);
    }
  }
}
