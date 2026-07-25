import { HttpAuthService } from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod/v3';
import { generateArtifacts } from './generator';
import { Publisher } from './publisher';

const fieldSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean', 'enum']),
  enum: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const definitionSchema = z.object({
  name: z.string(),
  title: z.string(),
  category: z.string().optional(),
  owner: z.string().optional(),
  fields: z.array(fieldSchema),
});

export async function createRouter({
  httpAuth,
  publisher,
}: {
  httpAuth: HttpAuthService;
  publisher: Publisher;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  router.post('/definitions', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const parsed = definitionSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.toString());
    const def = parsed.data;

    const { templateYaml, workflowTemplate } = generateArtifacts(def);
    const templatePath = `templates/${def.name}/template.yaml`;

    await publisher.commitFile(
      templatePath,
      templateYaml,
      `feat: add ${def.name} template`,
    );
    await publisher.ensureLocationTarget(def.name);
    await publisher.registerWorkflowTemplate(workflowTemplate);

    res.status(201).json({ name: def.name, templatePath, requestable: true });
  });

  return router;
}
