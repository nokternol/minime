import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { server } from '../../../tests/server'
import { http, HttpResponse } from 'msw'
import { describe, test, expect, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))

describe('/chat/new', () => {
  test('POSTs type:idea and has no type selector', async () => {
    let capturedBody: Record<string, unknown> = {}
    server.use(
      http.post('http://localhost:8744/api/capture', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({ id: 'x', pr: 1, branch: 'b' })
      })
    )

    render(Page)

    expect(screen.queryByRole('combobox')).toBeNull()

    await userEvent.type(screen.getByPlaceholderText(/title/i), 'My first idea')
    await userEvent.click(screen.getByRole('button', { name: /capture/i }))

    await waitFor(() => expect(capturedBody.type).toBe('idea'))
  })

  test('shows error message when capture API returns 500', async () => {
    server.use(
      http.post('http://localhost:8744/api/capture', () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 })
      )
    )

    render(Page)
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Bad idea')
    await userEvent.click(screen.getByRole('button', { name: /capture/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    )
  })
})
