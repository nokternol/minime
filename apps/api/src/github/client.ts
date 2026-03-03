const BASE = 'https://api.github.com';

export class GitHubClient {
  constructor(
    private readonly token: string,
    public readonly owner: string,
    public readonly repo: string
  ) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async getFile(path: string, branch = 'main') {
    return this.request<{ content: string; sha: string; encoding: string }>(
      `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`
    );
  }

  async upsertFile(path: string, content: string, message: string, branch: string, sha?: string) {
    return this.request(`/repos/${this.owner}/${this.repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  async createBranch(name: string, fromBranch = 'main') {
    const ref = await this.request<{ object: { sha: string } }>(
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${fromBranch}`
    );
    return this.request(`/repos/${this.owner}/${this.repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: ref.object.sha }),
    });
  }

  async createPR(title: string, head: string, body = '') {
    return this.request<{ number: number; html_url: string }>(
      `/repos/${this.owner}/${this.repo}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({ title, head, base: 'main', body, draft: false }),
      }
    );
  }

  async mergePR(prNumber: number) {
    return this.request(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash' }),
    });
  }

  async closePR(prNumber: number) {
    return this.request(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    });
  }

  async deleteBranch(name: string) {
    return this.request(`/repos/${this.owner}/${this.repo}/git/refs/heads/${name}`, {
      method: 'DELETE',
    });
  }

  async listOpenPRs() {
    return this.request<Array<{ number: number; title: string; head: { ref: string } }>>(
      `/repos/${this.owner}/${this.repo}/pulls?state=open&per_page=100`
    );
  }

  async listFiles(path: string, branch = 'main') {
    return this.request<Array<{ name: string; path: string; type: string }>>(
      `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`
    );
  }
}
