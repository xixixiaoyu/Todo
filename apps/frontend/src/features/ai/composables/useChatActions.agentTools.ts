import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type { Tool } from '@/features/ai/services/aiService'
import { AGENT_TOOL_NAMES } from '@lumina/shared'
import { useSessionFiles } from '@/features/ai/composables/useSessionFiles'

/**
 * Agent 工具定义（AI function calling 格式）
 */
export const AGENT_TOOL_DEFINITIONS: Tool[] = [
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.READ_FILE,
      description:
        'Read a file from the local filesystem. Returns file contents with line numbers.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file to read' },
          startLine: {
            type: 'number',
            description: 'Line number to start reading from (1-indexed)',
          },
          endLine: {
            type: 'number',
            description: 'Line number to end reading at (1-indexed, inclusive)',
          },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.WRITE_FILE,
      description:
        'Write content to a file on the local filesystem. Creates the file if it does not exist, overwrites if it does.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.EDIT_FILE,
      description:
        'Perform exact string replacements in a file. Search for old_string and replace with new_string.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file to edit' },
          oldString: { type: 'string', description: 'Exact string to search for and replace' },
          newString: { type: 'string', description: 'Replacement string' },
          replaceAll: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
        },
        required: ['filePath', 'oldString', 'newString'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.LS,
      description: 'List contents of a directory.',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: 'Absolute path to the directory to list' },
        },
        required: ['dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.GREP,
      description: 'Search for a regular expression pattern in files within a directory.',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: 'Absolute path to the directory to search in' },
          pattern: { type: 'string', description: 'Regular expression pattern to search for' },
          fileTypes: { type: 'string', description: 'File extension filter, e.g. ".ts,.vue"' },
          caseSensitive: { type: 'boolean', description: 'Case-sensitive search (default: false)' },
        },
        required: ['dirPath', 'pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.FIND,
      description: 'Find files matching a glob pattern within a directory.',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: 'Absolute path to the directory to search in' },
          glob: { type: 'string', description: 'Glob pattern, e.g. "**/*.ts" or "*.vue"' },
        },
        required: ['dirPath', 'glob'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.MKDIR,
      description: 'Create a directory (including parent directories as needed).',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: 'Absolute path to the directory to create' },
        },
        required: ['dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.BASH,
      description: 'Execute a shell command within the allowed workspace directories.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          cwd: { type: 'string', description: 'Working directory for command execution' },
          timeout: {
            type: 'number',
            description: 'Command timeout in ms (max 60000, default 30000)',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AGENT_TOOL_NAMES.STAGE_FILES,
      description:
        'Register files to the current session for delivery to the user. Use when you create, find, or receive files that should be presented to the user.',
      parameters: {
        type: 'object',
        properties: {
          filepaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of absolute file paths to stage',
          },
          label: { type: 'string', description: 'Optional label for the staged files' },
        },
        required: ['filepaths'],
      },
    },
  },
]

type LocalToolHandler = (args: Record<string, unknown>) => string | Promise<string>

interface SidecarState {
  port: number | null
  token: string | null
  isAvailable: boolean
}

function createSidecarAxios(port: number, token: string): AxiosInstance {
  return axios.create({
    baseURL: `http://127.0.0.1:${port}/sidecar`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
}

function formatFileList(entries: Array<{ name: string; type: string; size: number }>): string {
  if (entries.length === 0) return 'Directory is empty.'
  const lines = entries.map((e) => {
    const prefix = e.type === 'directory' ? 'd' : '-'
    const size = e.type === 'file' ? ` (${e.size} bytes)` : ''
    return `${prefix} ${e.name}${size}`
  })
  return lines.join('\n')
}

/**
 * 构建 Agent 工具的 localToolHandlers Map
 */
export function buildAgentLocalToolHandlers(params: {
  sidecar: SidecarState
}): Map<string, LocalToolHandler> {
  const handlers = new Map<string, LocalToolHandler>()

  const getAxios = (): AxiosInstance => {
    if (params.sidecar.isAvailable && params.sidecar.port && params.sidecar.token) {
      return createSidecarAxios(params.sidecar.port, params.sidecar.token)
    }
    throw new Error('Sidecar is not available. Agent file tools require a running local Sidecar.')
  }

  const sidecarPost = async (path: string, body: Record<string, unknown>): Promise<unknown> => {
    const client = getAxios()
    const { data } = await client.post(path, body)
    return data
  }

  // read_file handler
  handlers.set(AGENT_TOOL_NAMES.READ_FILE, async (args) => {
    const filePath = (args.filePath || args.file_path) as string
    if (!filePath) return 'Error: filePath is required'
    const result = await sidecarPost('/fs/read', {
      filePath,
      startLine: args.startLine ?? args.start_line,
      endLine: args.endLine ?? args.end_line,
    })
    const r = result as {
      success?: boolean
      data?: { content?: string; totalLines?: number }
      message?: string
    }
    if (r.success && r.data) {
      const info = r.data.totalLines ? ` (${r.data.totalLines} lines total)` : ''
      return r.data.content + info
    }
    return `Error: ${(r as { message?: string }).message || 'Failed to read file'}`
  })

  // write_file handler
  handlers.set(AGENT_TOOL_NAMES.WRITE_FILE, async (args) => {
    const filePath = (args.filePath || args.file_path) as string
    const result = await sidecarPost('/fs/write', { filePath, content: args.content })
    const r = result as { success?: boolean; data?: { message?: string }; message?: string }
    if (r.success) {
      try {
        const { addFile } = useSessionFiles()
        const fileName = filePath.split('/').pop() || filePath
        addFile({ path: filePath, name: fileName, size: 0, source: 'write_file' })
      } catch {
        /* 非 Vue setup 上下文，跳过 */
      }
      return r.data?.message || 'File written successfully.'
    }
    return `Error: ${r.message || 'Failed to write file'}`
  })

  // edit_file handler
  handlers.set(AGENT_TOOL_NAMES.EDIT_FILE, async (args) => {
    const filePath = (args.filePath || args.file_path) as string
    const result = await sidecarPost('/fs/edit', {
      filePath,
      oldString: args.oldString || args.old_string,
      newString: args.newString || args.new_string,
      replaceAll: args.replaceAll ?? args.replace_all ?? false,
    })
    const r = result as {
      success?: boolean
      data?: { message?: string; replacements?: number }
      message?: string
    }
    if (r.success) {
      try {
        const { addFile } = useSessionFiles()
        addFile({
          path: filePath,
          name: filePath.split('/').pop() || filePath,
          size: 0,
          source: 'edit_file',
        })
      } catch {
        /* skip */
      }
      return r.data?.message || `Edit applied: ${r.data?.replacements ?? 0} replacement(s) made.`
    }
    return `Error: ${r.message || 'Failed to edit file'}`
  })

  // ls handler
  handlers.set(AGENT_TOOL_NAMES.LS, async (args) => {
    const dirPath = (args.dirPath || args.dir_path) as string
    if (!dirPath) return 'Error: dirPath is required'
    const result = await sidecarPost('/fs/ls', { dirPath })
    const r = result as {
      success?: boolean
      data?: { entries?: Array<{ name: string; type: string; size: number }> }
      message?: string
    }
    if (r.success && r.data?.entries) {
      return formatFileList(r.data.entries)
    }
    return `Error: ${r.message || 'Failed to list directory'}`
  })

  // grep handler
  handlers.set(AGENT_TOOL_NAMES.GREP, async (args) => {
    const result = await sidecarPost('/fs/grep', {
      dirPath: args.dirPath || args.dir_path,
      pattern: args.pattern,
      fileTypes: args.fileTypes ?? args.file_types,
      caseSensitive: args.caseSensitive ?? args.case_sensitive ?? false,
    })
    const r = result as {
      success?: boolean
      data?: {
        matches?: Array<{ file: string; line: number; content: string }>
        totalMatches?: number
      }
      message?: string
    }
    if (r.success && r.data?.matches) {
      if (r.data.matches.length === 0) return 'No matches found.'
      const lines = r.data.matches.map((m) => `${m.file}:${m.line}: ${m.content}`)
      const summary = r.data.totalMatches ? `\n(${r.data.totalMatches} total matches)` : ''
      return lines.join('\n') + summary
    }
    return `Error: ${r.message || 'Failed to search'}`
  })

  // find handler
  handlers.set(AGENT_TOOL_NAMES.FIND, async (args) => {
    const result = await sidecarPost('/fs/find', {
      dirPath: args.dirPath || args.dir_path,
      glob: args.glob,
    })
    const r = result as {
      success?: boolean
      data?: { files?: string[]; count?: number }
      message?: string
    }
    if (r.success && r.data?.files) {
      if (r.data.files.length === 0) return 'No files found matching the pattern.'
      return r.data.files.join('\n') + `\n(${r.data.count ?? r.data.files.length} files found)`
    }
    return `Error: ${r.message || 'Failed to find files'}`
  })

  // mkdir handler
  handlers.set(AGENT_TOOL_NAMES.MKDIR, async (args) => {
    const dirPath = (args.dirPath || args.dir_path) as string
    if (!dirPath) return 'Error: dirPath is required'
    const result = await sidecarPost('/fs/mkdir', { dirPath })
    const r = result as { success?: boolean; data?: { message?: string }; message?: string }
    if (r.success) return r.data?.message || 'Directory created successfully.'
    return `Error: ${r.message || 'Failed to create directory'}`
  })

  // bash handler
  handlers.set(AGENT_TOOL_NAMES.BASH, async (args) => {
    const command = args.command as string
    if (!command) return 'Error: command is required'
    const result = await sidecarPost('/bash', {
      command,
      cwd: args.cwd,
      timeout: args.timeout ?? 30000,
    })
    const r = result as {
      success?: boolean
      data?: { stdout?: string; stderr?: string; exitCode?: number }
      message?: string
    }
    if (r.success && r.data) {
      let output = ''
      if (r.data.stdout) output += r.data.stdout
      if (r.data.stderr) output += (output ? '\n[stderr]\n' : '') + r.data.stderr
      output += `\n(exit code: ${r.data.exitCode ?? 0})`
      return output || '(no output)'
    }
    return `Error: ${r.message || 'Command execution failed'}`
  })

  // stage_files handler — 本地注册会话文件
  handlers.set(AGENT_TOOL_NAMES.STAGE_FILES, async (args) => {
    const filepaths = (args.filepaths || (args.filePath ? [args.filePath] : null)) as
      | string[]
      | null
    if (!filepaths || filepaths.length === 0) return 'Error: filepaths is required'
    try {
      const { addFile } = useSessionFiles()
      const names: string[] = []
      for (const fp of filepaths) {
        const name = fp.split('/').pop() || fp
        addFile({ path: fp, name, size: 0, source: 'stage_files' })
        names.push(name)
      }
      return `Files staged to current session: ${names.join(', ')}`
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  })

  return handlers
}
