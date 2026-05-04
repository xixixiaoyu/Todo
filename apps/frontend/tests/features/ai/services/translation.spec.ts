import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectLanguage, translateText } from '@/features/ai/services/translation'
import { _resetAIConfig } from '@/features/ai/composables/useAIConfig'

const fetchMock = vi.mocked(fetch)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem(
    'ai-config',
    JSON.stringify({ baseUrl: 'https://api.test.com', apiKey: 'sk-test', model: 'test-model' }),
  )
  _resetAIConfig()
})

describe('detectLanguage', () => {
  it('返回 zh 当包含中文字符', () => {
    expect(detectLanguage('你好世界')).toBe('zh')
  })

  it('返回 zh 当包含中英混合', () => {
    expect(detectLanguage('你好 Hello world')).toBe('zh')
  })

  it('返回 non-zh 当纯英文', () => {
    expect(detectLanguage('Hello world')).toBe('non-zh')
  })

  it('返回 non-zh 当纯数字', () => {
    expect(detectLanguage('12345')).toBe('non-zh')
  })

  it('返回 non-zh 当空字符串', () => {
    expect(detectLanguage('')).toBe('non-zh')
  })
})

describe('translateText', () => {
  it('发送正确的翻译请求并返回译文', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Hello world' } }] }),
    } as unknown as Response)

    const result = await translateText('你好世界', 'en', {
      baseUrl: 'https://api.test.com',
      apiKey: 'sk-test',
      model: 'test-model',
    } as Parameters<typeof translateText>[2])

    expect(result).toBe('Hello world')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/chat/completions')

    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('test-model')
    expect(body.stream).toBe(false)
    expect(body.temperature).toBe(0.3)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toContain('English')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toBe('你好世界')
  })

  it('翻译成中文时提示词包含 Chinese', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '你好世界' } }] }),
    } as unknown as Response)

    await translateText('Hello world', 'zh', {
      baseUrl: 'https://api.test.com',
      apiKey: 'sk-test',
      model: 'test-model',
    } as Parameters<typeof translateText>[2])

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.messages[0].content).toContain('Chinese')
  })

  it('API 错误时 throw Error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    } as unknown as Response)

    await expect(
      translateText('test', 'en', {
        baseUrl: 'https://api.test.com',
        apiKey: 'sk-test',
        model: 'test-model',
      } as Parameters<typeof translateText>[2]),
    ).rejects.toThrow('Translation API error')
  })

  it('abort signal 生效', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementationOnce((_url, init) => {
      if (init?.signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'Hello' } }] }),
      } as unknown as Response)
    })

    controller.abort()

    await expect(
      translateText(
        '你好',
        'en',
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'sk-test',
          model: 'test-model',
        } as Parameters<typeof translateText>[2],
        controller.signal,
      ),
    ).rejects.toThrow('Aborted')
  })

  it('处理 choices 为空时返回空字符串', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    } as unknown as Response)

    const result = await translateText('test', 'en', {
      baseUrl: 'https://api.test.com',
      apiKey: 'sk-test',
      model: 'test-model',
    } as Parameters<typeof translateText>[2])

    expect(result).toBe('')
  })
})
