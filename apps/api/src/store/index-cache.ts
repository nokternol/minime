import type { GitHubClient } from '../github/client.js';
import { buildIndex } from '../index-builder/build.js';
import type { IndexEntry } from '../index-builder/build.js';

export class IndexCache {
  private entries: IndexEntry[] = [];
  private lastBuilt: Date | null = null;

  constructor(private readonly github: GitHubClient) {}

  async load(): Promise<void> {
    this.entries = await buildIndex(this.github);
    this.lastBuilt = new Date();
    console.log(`[index-cache] loaded ${this.entries.length} entries`);
  }

  all(): IndexEntry[] {
    return [...this.entries];
  }

  byType(type: string): IndexEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  byStatus(status: string): IndexEntry[] {
    return this.entries.filter((e) => e.status === status);
  }

  search(query: string): IndexEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.summary?.toLowerCase().includes(q) ?? false) ||
        (e.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
    );
  }

  findById(id: string): IndexEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  findByBranch(branch: string): IndexEntry | undefined {
    return this.entries.find((e) => e.branch === branch);
  }

  upsert(entry: IndexEntry): void {
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) this.entries[idx] = entry;
    else this.entries.unshift(entry);
  }

  getLastBuilt(): Date | null {
    return this.lastBuilt;
  }
}
