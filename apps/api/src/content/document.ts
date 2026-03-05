import { ulid } from 'ulid';

export interface CaptureInput {
  type: 'idea' | 'plan' | 'discussion' | 'solution';
  title: string;
  tags: string[];
  summary: string;
  body: string;
  related_to?: string;
  promoted_from?: string[];
  language?: string;
  problem?: string;
}

export function buildDocument(input: CaptureInput) {
  const id = ulid();
  const now = new Date().toISOString();
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  const filename = `${now.split('T')[0]}-${slug}.md`;
  const path = `${input.type}s/${filename}`;
  const branchName = `${input.type}/${id.toLowerCase()}-${slug}`;

  const frontmatter: Record<string, unknown> = {
    id,
    type: input.type,
    title: input.title,
    status: 'draft',
    tags: input.tags,
    summary: input.summary,
    created: now,
    updated: now,
    branch: branchName,
    ...(input.related_to ? { related_to: input.related_to } : {}),
    ...(input.promoted_from ? { promoted_from: input.promoted_from } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.problem ? { problem: input.problem } : {}),
  };

  const yaml = Object.entries(frontmatter)
    .map(
      ([k, v]) =>
        `${k}: ${Array.isArray(v) ? `[${(v as string[]).join(', ')}]` : JSON.stringify(v)}`
    )
    .join('\n');

  const content = `---\n${yaml}\n---\n\n${input.body}`;
  return { id, path, content, filename, branchName };
}
