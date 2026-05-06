import { z } from 'zod'

export const ReadFileSchema = z.object({
  filePath: z.string().min(1).describe('Absolute path to the file to read'),
  startLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Line number to start reading from (1-indexed)'),
  endLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Line number to end reading at (1-indexed, inclusive)'),
})

export const WriteFileSchema = z.object({
  filePath: z.string().min(1).describe('Absolute path to the file to write'),
  content: z.string().describe('Content to write to the file'),
})

export const EditFileSchema = z.object({
  filePath: z.string().min(1).describe('Absolute path to the file to edit'),
  oldString: z.string().min(1).describe('Exact string to search for and replace'),
  newString: z.string().describe('Replacement string'),
  replaceAll: z.boolean().optional().describe('Replace all occurrences (default: false)'),
})

export const ListDirectorySchema = z.object({
  dirPath: z.string().min(1).describe('Absolute path to the directory to list'),
})

export const GrepSchema = z.object({
  dirPath: z.string().min(1).describe('Absolute path to the directory to search in'),
  pattern: z.string().min(1).describe('Regular expression pattern to search for'),
  fileTypes: z.string().optional().describe('File extension filter, e.g. ".ts,.vue"'),
  caseSensitive: z.boolean().optional().describe('Case-sensitive search (default: false)'),
})

export const FindSchema = z.object({
  dirPath: z.string().min(1).describe('Absolute path to the directory to search in'),
  glob: z.string().min(1).describe('Glob pattern, e.g. "**/*.ts" or "*.vue"'),
})

export const MkdirSchema = z.object({
  dirPath: z.string().min(1).describe('Absolute path to the directory to create'),
})

export const BashSchema = z.object({
  command: z.string().min(1).describe('Shell command to execute'),
  cwd: z.string().optional().describe('Working directory for command execution'),
  timeout: z
    .number()
    .int()
    .positive()
    .max(60000)
    .optional()
    .describe('Command timeout in ms (max 60000, default 30000)'),
})

export const StageFilesSchema = z.object({
  filepaths: z.array(z.string().min(1)).min(1).describe('Array of absolute file paths to stage'),
  label: z.string().optional().describe('Optional label for the staged files'),
})

export const TaskSchema = z.object({
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        subject: z.string().min(1).describe('Short task description'),
        prompt: z.string().min(1).describe('Full prompt for the sub-agent to execute'),
      }),
    )
    .min(1)
    .max(10)
    .describe('Subtasks to execute in parallel (max 10)'),
})

export const agentToolSchemas = {
  read_file: ReadFileSchema,
  write_file: WriteFileSchema,
  edit_file: EditFileSchema,
  ls: ListDirectorySchema,
  grep: GrepSchema,
  find: FindSchema,
  mkdir: MkdirSchema,
  bash: BashSchema,
  stage_files: StageFilesSchema,
  task: TaskSchema,
} as const

export type AgentToolSchemas = typeof agentToolSchemas
