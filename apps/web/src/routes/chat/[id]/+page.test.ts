import { render, screen, waitFor } from '@testing-library/svelte'
import { server } from '../../../tests/server'
import { http, HttpResponse } from 'msw'
import { describe, test, expect, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store')
  return { page: readable({ params: { id: 'test-id' }, url: new URL('http://localhost/chat/test-id'), route: { id: '/chat/[id]' } }) }
})
vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

describe('/chat/[id]', () => {
  test('shows Commit button when contentById returns a pr field', async () => {
    server.use(
      http.get('http://localhost:8744/api/content/test-id', () =>
        HttpResponse.json({
          id: 'test-id',
          type: 'idea',
          title: 'Test idea',
          status: 'draft',
          tags: [],
          summary: '',
          created: '2026-01-01',
          updated: '2026-01-01',
          path: 'wiki/test-id.md',
          body: '',
          pr: 42,
          branch: 'feat/test-id',
        })
      )
    )

    render(Page)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /commit/i })).toBeInTheDocument()
    )
  })
})
