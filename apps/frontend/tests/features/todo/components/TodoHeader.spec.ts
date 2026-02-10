import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import TodoHeader from '@/features/todo/components/TodoHeader.vue'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock lucide-vue-next components
vi.mock('lucide-vue-next', () => ({
  Clover: { template: '<span>Clover</span>' },
  Languages: { template: '<span class="lucide-languages">Languages</span>' },
  Network: { template: '<span>Network</span>' },
  List: { template: '<span>List</span>' },
  User: { template: '<span>User</span>' },
  LogOut: { template: '<span>LogOut</span>' },
  LogIn: { template: '<span>LogIn</span>' },
  Monitor: { template: '<span>Monitor</span>' },
  Sun: { template: '<span>Sun</span>' },
  Moon: { template: '<span>Moon</span>' },
  BarChart3: { template: '<span>BarChart3</span>' },
  MoreHorizontal: { template: '<span>MoreHorizontal</span>' },
}))

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      ai: {
        assistant: 'AI 助手',
      },
      todo: {
        visualMode: '可视化视图',
        listMode: '列表视图',
        statsMode: '统计视图',
      },
      common: {
        appName: '简思',
        beta: 'Beta',
        settings: '设置',
        toggleLanguage: '切换语言',
        logout: '退出登录',
        theme: {
          label: '主题',
          light: '浅色',
          dark: '深色',
          system: '跟随系统',
        },
      },
      login: {
        title: '登录账户',
      },
    },
    'en-US': {
      ai: {
        assistant: 'AI Assistant',
      },
      todo: {
        visualMode: 'Visual Mode',
        listMode: 'List Mode',
        statsMode: 'Statistics',
      },
      common: {
        appName: 'Lumina',
        beta: 'Beta',
        settings: 'Settings',
        toggleLanguage: 'Switch Language',
        logout: 'Logout',
        theme: {
          label: 'Theme',
          light: 'Light',
          dark: 'Dark',
          system: 'System',
        },
      },
      login: {
        title: 'Sign in to your account',
      },
    },
  },
})

describe('TodoHeader', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('应该正确渲染标题', () => {
    const wrapper = mount(TodoHeader, {
      global: {
        plugins: [i18n],
        stubs: {
          TooltipProvider: true,
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          DropdownMenu: { template: '<div><slot /></div>' },
          DropdownMenuTrigger: { template: '<div><slot /></div>' },
          DropdownMenuContent: { template: '<div><slot /></div>' },
          DropdownMenuItem: { template: '<div><slot /></div>' },
          DropdownMenuLabel: { template: '<div><slot /></div>' },
          DropdownMenuSeparator: { template: '<div><slot /></div>' },
        },
      },
    })

    const title = wrapper.find('h1').text()
    expect(title).toContain('简思')
    expect(title).toContain('Beta')
  })

  it('点击语言切换按钮应该切换语言并保存到 localStorage', async () => {
    const wrapper = mount(TodoHeader, {
      global: {
        plugins: [i18n],
        stubs: {
          TooltipProvider: true,
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          DropdownMenu: true,
          DropdownMenuTrigger: true,
          DropdownMenuContent: true,
          DropdownMenuItem: true,
          DropdownMenuLabel: true,
          DropdownMenuSeparator: true,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    const langButton = buttons.find((b) => b.text().includes('Languages'))

    // 初始是 zh-CN
    expect(i18n.global.locale.value).toBe('zh-CN')

    await langButton?.trigger('click')

    // 切换到 en-US
    expect(i18n.global.locale.value).toBe('en-US')
    expect(localStorage.getItem('locale')).toBe('en-US')

    await langButton?.trigger('click')

    // 切换回 zh-CN
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(localStorage.getItem('locale')).toBe('zh-CN')
  })

  it('应该包含语言切换按钮', () => {
    const wrapper = mount(TodoHeader, {
      global: {
        plugins: [i18n],
        stubs: {
          TooltipProvider: true,
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          DropdownMenu: true,
          DropdownMenuTrigger: true,
          DropdownMenuContent: true,
          DropdownMenuItem: true,
          DropdownMenuLabel: true,
          DropdownMenuSeparator: true,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    const langButton = buttons.find((b) => b.text().includes('Languages'))
    expect(langButton?.exists()).toBe(true)
  })
})
