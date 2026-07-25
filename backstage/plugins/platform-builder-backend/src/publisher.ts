import { LoggerService } from '@backstage/backend-plugin-api';

export interface PublisherConfig {
  giteaBaseUrl: string;
  // Basic-auth against the seeded Gitea admin (reproducible; no minted token).
  giteaUser: string;
  giteaPassword: string;
  owner: string;
  repo: string;
  argoBaseUrl: string;
  argoNamespace: string;
}

/** Gitea contents API GET response (subset we use). */
interface GiteaContent {
  content?: string;
  sha?: string;
}

/**
 * Publishes generated artifacts: template files + catalog Location wiring to the
 * Gitea templates repo (contents API), and the WorkflowTemplate to argo-server.
 */
export class Publisher {
  constructor(
    private readonly cfg: PublisherConfig,
    private readonly logger: LoggerService,
  ) {}

  private contentsUrl(path: string): string {
    const { giteaBaseUrl, owner, repo } = this.cfg;
    return `${giteaBaseUrl}/api/v1/repos/${owner}/${repo}/contents/${path}`;
  }

  private get giteaHeaders(): Record<string, string> {
    const basic = Buffer.from(
      `${this.cfg.giteaUser}:${this.cfg.giteaPassword}`,
    ).toString('base64');
    return {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    };
  }

  /** Fetch a file's content+sha, or undefined if it does not exist (404). */
  private async getFile(path: string): Promise<GiteaContent | undefined> {
    const res = await fetch(this.contentsUrl(path), {
      headers: this.giteaHeaders,
    });
    if (res.status === 404) return undefined;
    if (!res.ok) {
      throw new Error(`gitea GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as GiteaContent;
  }

  /** Create-or-update a file in the templates repo via the Gitea contents API.
   * Gitea uses POST to create a new file and PUT (with the current sha) to update. */
  async commitFile(path: string, content: string, message: string): Promise<void> {
    const existing = await this.getFile(path);
    const res = await fetch(this.contentsUrl(path), {
      method: existing?.sha ? 'PUT' : 'POST',
      headers: this.giteaHeaders,
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: 'main',
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`gitea PUT ${path} failed: ${res.status} ${await res.text()}`);
    }
    this.logger.info(`committed ${path} to ${this.cfg.owner}/${this.cfg.repo}`);
  }

  /** Add `./templates/<name>/template.yaml` to the root Location's targets if absent. */
  async ensureLocationTarget(name: string): Promise<void> {
    const path = 'catalog-info.yaml';
    const existing = await this.getFile(path);
    if (!existing?.content) {
      throw new Error(`gitea: ${path} not found; cannot wire Location target`);
    }
    const current = Buffer.from(existing.content, 'base64').toString('utf8');
    const target = `./templates/${name}/template.yaml`;
    if (current.includes(target)) {
      this.logger.info(`Location already targets ${target}`);
      return;
    }
    // Insert the new list item right after the `targets:` line, matching its indent.
    const lines = current.split('\n');
    const idx = lines.findIndex(l => /^\s*targets:\s*$/.test(l));
    if (idx === -1) throw new Error(`gitea: no 'targets:' in ${path}`);
    const indent = (lines[idx].match(/^(\s*)/)?.[1] ?? '') + '  ';
    lines.splice(idx + 1, 0, `${indent}- ${target}`);
    await this.commitFile(path, lines.join('\n'), `chore: register ${name} template`);
  }

  /** Register (or update on 409) the WorkflowTemplate via argo-server REST. */
  async registerWorkflowTemplate(manifest: object): Promise<void> {
    const { argoBaseUrl, argoNamespace } = this.cfg;
    const base = `${argoBaseUrl}/api/v1/workflow-templates/${argoNamespace}`;
    const name = (manifest as { metadata?: { name?: string } }).metadata?.name;

    const create = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: manifest }),
    });
    if (create.ok) {
      this.logger.info(`registered WorkflowTemplate ${name}`);
      return;
    }
    if (create.status !== 409) {
      throw new Error(
        `argo create WorkflowTemplate failed: ${create.status} ${await create.text()}`,
      );
    }
    // Already exists → update in place.
    const update = await fetch(`${base}/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: manifest }),
    });
    if (!update.ok) {
      throw new Error(
        `argo update WorkflowTemplate failed: ${update.status} ${await update.text()}`,
      );
    }
    this.logger.info(`updated WorkflowTemplate ${name}`);
  }
}
