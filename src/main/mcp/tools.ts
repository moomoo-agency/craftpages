import { readFile } from 'fs/promises'
import { extname } from 'path'
import { previewUrl } from '../editing'
import { scanComponents } from '../html/components'
import { pageOutline } from '../html/outline'
import { capture } from '../preview/capture'
import { getSiteSettings } from '../settings'
import { getWorkspace, requireRoot } from '../state'
import { listFiles, resolveInWorkspace } from '../workspace'
import { GUIDES } from '../guides'
import { getSelection } from './selection'
import { proposalPreviewUrl } from './previews'
import {
  createProposal,
  getProposal,
  isAutoAccept,
  listProposals,
  waitForDecision,
  type ChangeOp
} from './proposals'
import type { Proposal } from '../../shared/types'

export type ToolContent =
  { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

export interface ToolContext {
  client: string
}

interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: Record<string, unknown>
  run: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolContent[] | string>
}

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.md', '.svg', '.webmanifest', ''
]) // prettier-ignore

const json = (value: unknown): string => JSON.stringify(value, null, 2)

function str(args: Record<string, unknown>, name: string, required = true): string {
  const value = args[name]
  if (typeof value === 'string') return value
  if (value === undefined && !required) return ''
  throw new Error(`${name} must be a string`)
}

function num(
  args: Record<string, unknown>,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const value = args[name] === undefined ? fallback : Number(args[name])
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`)
  return Math.min(max, Math.max(min, Math.round(value)))
}

function summary(proposal: Proposal): Record<string, unknown> {
  return {
    id: proposal.id,
    title: proposal.title,
    status: proposal.status,
    reason: proposal.reason,
    files: proposal.files.map((file) => ({
      path: file.path,
      change: file.before === null ? 'create' : file.after === null ? 'delete' : 'modify'
    }))
  }
}

export const INSTRUCTIONS = `CraftPages is a desktop editor for a plain-HTML static site (no build step, no templating: every page is a complete HTML file). You are connected to the one project (site folder) the user has open. It can change while you work: the server sends a project_switched notice.

- Read with list_pages, list_files, read_file and page_outline (a tag tree with line numbers). get_selection returns what the user last clicked in the page editor.
- Start with site_info. Every propose_change must name that project; changes to any other project are refused.
- You cannot write files directly. Call propose_change: the user sees a diff and a live preview, then accepts or rejects it. Use get_proposal with wait_seconds to wait for the decision.
- Keep edits minimal and exact: an "edit" replaces old_text with new_text, and old_text must match the file exactly once. Keep untouched markup byte-identical.
- Header, footer and nav are copied into every page; list_components shows which blocks repeat, and a change to one usually belongs on every page that has it.
- render_preview returns a screenshot of a page, optionally with a pending proposal applied, so you can check your work visually.
- Some features are built into CraftPages (e.g. site search). Before adding one, call list_guides and read the matching guide with get_guide, and follow it instead of building your own.`

export const TOOLS: Tool[] = [
  {
    name: 'site_info',
    description:
      'The open site: folder name, page count, base URL and whether proposals are auto-accepted.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async () => {
      const workspace = getWorkspace()
      if (!workspace) return 'No project is open in CraftPages.'
      const site = await getSiteSettings(workspace.root)
      return json({
        project: workspace.folder,
        folder: workspace.root,
        siteName: site.siteName,
        baseUrl: site.baseUrl,
        pages: workspace.pages.length,
        autoAccept: isAutoAccept()
      })
    }
  },
  {
    name: 'list_guides',
    description:
      'Features CraftPages provides (e.g. site search), each with a guide on how to add it to the site. Check here before building a feature yourself.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async () =>
      json(
        Object.entries(GUIDES).map(([name, guide]) => ({
          name,
          title: guide.title,
          summary: guide.summary
        }))
      )
  },
  {
    name: 'get_guide',
    description: 'How a CraftPages feature works and how to add it to the site (markdown).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Guide name from list_guides, e.g. "search"' }
      },
      required: ['name']
    },
    annotations: { readOnlyHint: true },
    run: async (args) => {
      const guide = GUIDES[str(args, 'name')]
      if (!guide) throw new Error(`No guide named ${str(args, 'name')}. See list_guides.`)
      return guide.text
    }
  },
  {
    name: 'list_pages',
    description: 'Every HTML page of the site with its <title> and size.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async () => {
      requireRoot()
      return json(getWorkspace()!.pages)
    }
  },
  {
    name: 'list_files',
    description: 'Every file of the site (HTML, CSS, JS, images…), optionally only under a folder.',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Folder relative to the site root, e.g. "assets"' }
      }
    },
    annotations: { readOnlyHint: true },
    run: async (args) => {
      const root = requireRoot()
      const dir = str(args, 'dir', false).replace(/^\/+|\/+$/g, '')
      if (dir) resolveInWorkspace(root, dir)
      const files = await listFiles(root)
      return json(files.filter((file) => !dir || file.path.startsWith(dir + '/')))
    }
  },
  {
    name: 'read_file',
    description:
      'Reads a text file of the site (HTML, CSS, JS, JSON, XML, SVG…). Optionally a line range. Use the exact text you read as old_text in propose_change.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative to the site root, e.g. "index.html" or "assets/site.css"'
        },
        start_line: { type: 'number', description: '1-based first line (optional)' },
        end_line: { type: 'number', description: 'Last line, inclusive (optional)' }
      },
      required: ['path']
    },
    annotations: { readOnlyHint: true },
    run: async (args) => {
      const root = requireRoot()
      const path = str(args, 'path')
      if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) {
        throw new Error(`${path} is not a text file. Use render_preview to see images.`)
      }
      const text = await readFile(resolveInWorkspace(root, path), 'utf8')
      if (args.start_line === undefined && args.end_line === undefined) return text
      const lines = text.split('\n')
      const start = num(args, 'start_line', 1, 1, lines.length)
      const end = num(args, 'end_line', lines.length, start, lines.length)
      return lines.slice(start - 1, end).join('\n')
    }
  },
  {
    name: 'page_outline',
    description:
      'The <body> of a page as an indented tag tree (tag#id.classes, source line, short text) so you can locate markup without reading the whole file.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        max_depth: { type: 'number', description: 'Default 8' }
      },
      required: ['path']
    },
    annotations: { readOnlyHint: true },
    run: async (args) => {
      const root = requireRoot()
      const source = await readFile(resolveInWorkspace(root, str(args, 'path')), 'utf8')
      return pageOutline(source, num(args, 'max_depth', 8, 1, 40))
    }
  },
  {
    name: 'list_components',
    description:
      'Blocks repeated across pages (header, footer, nav, shared sections), with the pages that contain each. Variants = same block with different content on some pages.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async () => {
      const root = requireRoot()
      const groups = await scanComponents(
        root,
        getWorkspace()!.pages.map((page) => page.path)
      )
      return json(
        groups.map((group) => ({
          label: group.label,
          pages: group.pages,
          identical: group.variants.length === 1,
          variants:
            group.variants.length > 1 ? group.variants.map((variant) => variant.pages) : undefined
        }))
      )
    }
  },
  {
    name: 'get_selection',
    description:
      'What the user last clicked in the CraftPages page editor: page, CSS selector, tag, text and HTML.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async () =>
      json(getSelection() ?? { selection: null, hint: 'The user has not selected anything yet.' })
  },
  {
    name: 'render_preview',
    description:
      'Screenshot of a page as rendered by the local preview server. Pass proposal_id to see the page with a pending proposal applied.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Page path, e.g. "index.html" or "privacy/index.html"'
        },
        width: {
          type: 'number',
          description: 'Viewport width in px (default 1280; 390 for mobile)'
        },
        height: { type: 'number', description: 'Viewport height in px (default 900)' },
        full_page: { type: 'boolean', description: 'Capture the whole page height (max 8000 px)' },
        proposal_id: { type: 'string' }
      },
      required: ['path']
    },
    annotations: { readOnlyHint: true },
    run: async (args) => {
      requireRoot()
      const path = str(args, 'path')
      const proposal = str(args, 'proposal_id', false)
      const url = proposal ? await proposalPreviewUrl(proposal, path) : await previewUrl(path)
      const width = num(args, 'width', 1280, 320, 2560)
      const height = num(args, 'height', 900, 300, 4000)
      const image = await capture(url, width, height, args.full_page === true)
      return [
        { type: 'image', data: image.toString('base64'), mimeType: 'image/jpeg' },
        {
          type: 'text',
          text: `${path} at ${width}px${proposal ? ` with proposal ${proposal}` : ''}`
        }
      ]
    }
  },
  {
    name: 'propose_change',
    description:
      'Proposes changes to one or more site files. Nothing is written until the user accepts. Actions: "edit" (exact find/replace edits on an existing file), "write" (create or overwrite a whole file, e.g. a new template page), "delete". Returns the proposal id.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description:
            'The project you are changing, exactly as site_info returns it. Refused if the user has since opened another project.'
        },
        title: {
          type: 'string',
          description: 'Short summary the user sees, e.g. "Add FAQ section to pricing page"'
        },
        description: { type: 'string', description: 'Why, and anything the user should check' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              action: { type: 'string', enum: ['edit', 'write', 'delete'] },
              edits: {
                type: 'array',
                description: 'For "edit": applied in order',
                items: {
                  type: 'object',
                  properties: {
                    old_text: {
                      type: 'string',
                      description: 'Exact current text; must be unique unless replace_all'
                    },
                    new_text: { type: 'string' },
                    replace_all: { type: 'boolean' }
                  },
                  required: ['old_text', 'new_text']
                }
              },
              content: { type: 'string', description: 'For "write": the full new file contents' }
            },
            required: ['path', 'action']
          }
        }
      },
      required: ['project', 'title', 'changes']
    },
    run: async (args, context) => {
      // The AI connection is app-wide, but it may only ever change the project that is open now.
      const workspace = getWorkspace()
      if (!workspace) throw new Error('No project is open in CraftPages.')
      const named = str(args, 'project', false)
      if (!named)
        throw new Error(
          'Pass "project" (from site_info) so the change can be checked against the open project.'
        )
      if (named !== workspace.folder && named !== workspace.root) {
        throw new Error(
          `The open project is "${workspace.folder}", not "${named}". The user may have switched projects: call site_info and re-read the files before proposing.`
        )
      }
      const proposal = await createProposal(
        str(args, 'title'),
        str(args, 'description', false),
        context.client,
        args.changes as ChangeOp[]
      )
      const note =
        proposal.status === 'pending'
          ? 'Waiting for the user to accept or reject it in CraftPages. Call get_proposal with wait_seconds to wait.'
          : `Auto-accept is on: ${proposal.status}.`
      return `${json(summary(proposal))}\n\n${note}`
    }
  },
  {
    name: 'get_proposal',
    description:
      'Status of a proposal (pending / accepted / rejected / reverted / failed) and the reason given. With wait_seconds, waits up to that long for the user to decide.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        wait_seconds: { type: 'number', description: '0–300, default 0' }
      },
      required: ['id']
    },
    annotations: { readOnlyHint: true },
    run: async (args) => {
      const id = str(args, 'id')
      getProposal(id)
      return json(summary(await waitForDecision(id, num(args, 'wait_seconds', 0, 0, 300))))
    }
  },
  {
    name: 'list_proposals',
    description: 'Proposals made in this app session, newest first, with their status.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async () => json(listProposals().map(summary))
  }
]
