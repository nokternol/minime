import matter from 'gray-matter';

export function normalizeDocument(raw: string): string {
  const { data, content } = matter(raw);

  // Ensure required fields have defaults
  data.status ??= 'draft';
  data.tags ??= [];

  return matter.stringify(content, data);
}
