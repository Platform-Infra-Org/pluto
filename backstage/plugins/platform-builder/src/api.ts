import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';

export interface RequestField {
  name: string;
  title?: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  enum?: string[];
  required?: boolean;
}

export interface ServiceDefinitionInput {
  name: string;
  title: string;
  category?: string;
  /** Owning team (service owner): group entityRef or bare group name. */
  owner?: string;
  fields: RequestField[];
}

export interface PublishResult {
  name: string;
  templatePath: string;
  requestable: boolean;
}

export interface BuilderApi {
  createDefinition(def: ServiceDefinitionInput): Promise<PublishResult>;
}

export const builderApiRef = createApiRef<BuilderApi>({
  id: 'plugin.platform-builder.api',
});

export class BuilderClient implements BuilderApi {
  constructor(
    private readonly opts: { discoveryApi: DiscoveryApi; fetchApi: FetchApi },
  ) {}

  async createDefinition(def: ServiceDefinitionInput): Promise<PublishResult> {
    const base = await this.opts.discoveryApi.getBaseUrl('platform-builder');
    const res = await this.opts.fetchApi.fetch(`${base}/definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(def),
    });
    if (!res.ok) {
      throw new Error(`${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
}
