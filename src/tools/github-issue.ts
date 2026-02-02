import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod/v4'
import * as cli from '../cli/ui.js'

const GITHUB_API = 'https://api.github.com'

async function githubRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: any }> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN not configured')

  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  return { status: res.status, data }
}

export const createGithubIssueTool = tool(
  'create_github_issue',
  'Create a GitHub issue with @claude mention so Claude will automatically work on it. Use this when the user asks for coding tasks, bug fixes, or feature requests on their repos.',
  {
    repo: z.string().describe('Repository in format "owner/repo" (e.g. "JWPapi/deeplead")'),
    title: z.string().describe('Issue title'),
    body: z
      .string()
      .describe(
        'Issue body with detailed task description. Always end with @claude to trigger the Claude GitHub app.',
      ),
    labels: z.array(z.string()).optional().describe('Optional labels (e.g. ["bug", "enhancement"])'),
  },
  async args => {
    cli.print(`[GitHub] Creating issue on ${args.repo}: ${args.title}`)

    try {
      // Ensure body ends with @claude
      let body = args.body.trim()
      if (!body.includes('@claude')) {
        body += '\n\n@claude'
      }

      const { status, data } = await githubRequest('POST', `/repos/${args.repo}/issues`, {
        title: args.title,
        body,
        labels: args.labels || [],
      })

      if (status !== 201) {
        const msg = data.message || JSON.stringify(data)
        return {
          content: [{ type: 'text' as const, text: `GitHub API error (${status}): ${msg}` }],
          isError: true,
        }
      }

      cli.print(`[GitHub] Issue #${data.number} created: ${data.html_url}`)

      return {
        content: [
          {
            type: 'text' as const,
            text: `Issue #${data.number} created: ${data.html_url}\n\n@claude has been tagged and will start working on it automatically.`,
          },
        ],
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true }
    }
  },
)
