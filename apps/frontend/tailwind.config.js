import tailwindcssAnimate from 'tailwindcss-animate'
import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './components/**/*.{vue,js,ts,jsx,tsx}',
    './views/**/*.{vue,js,ts,jsx,tsx}',
    './pages/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    // 响应式断点 - 与 UnoCSS 保持一致
    screens: {
      xs: '320px',
      sm: '375px',
      md: '640px',
      lg: '768px',
      xl: '1024px',
      '2xl': '1280px',
      '3xl': '1536px',
    },
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      // 颜色系统 - 基于 CSS 变量
      colors: {
        // shadcn-vue 默认颜色
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#d4c18a',
          hover: '#c4b17a',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        // UnoCSS 自定义颜色系统
        bg: {
          DEFAULT: 'var(--bg-color)',
          card: 'var(--card-bg-color)',
        },
        text: {
          DEFAULT: 'var(--text-color)',
          secondary: 'var(--text-secondary-color)',
          todo: 'var(--todo-text-color)',
          completed: 'var(--completed-todo-text-color)',
        },
        'input-custom': {
          bg: 'var(--input-bg-color)',
          border: 'var(--input-border-color)',
          focus: 'var(--input-focus-color)',
        },
        button: {
          bg: 'var(--button-bg-color)',
          hover: 'var(--button-hover-bg-color)',
          text: 'var(--button-text-color)',
        },
        filter: {
          bg: 'var(--filter-btn-bg)',
          text: 'var(--filter-btn-text)',
          border: 'var(--filter-btn-border)',
          'active-bg': 'var(--filter-btn-active-bg)',
          'active-text': 'var(--filter-btn-active-text)',
          'active-border': 'var(--filter-btn-active-border)',
        },
        language: {
          bg: 'var(--language-toggle-bg)',
          color: 'var(--language-toggle-color)',
          hover: 'var(--language-toggle-hover-bg)',
        },
        project: {
          tag: 'var(--project-tag-bg-color)',
          'tag-text': 'var(--project-tag-text-color)',
        },
        link: {
          DEFAULT: 'var(--link-color)',
          hover: 'var(--link-hover-color)',
        },
        // 语义状态色
        success: 'var(--success-color)',
        warning: 'var(--warning-color)',
        info: 'var(--info-color)',
        error: 'var(--error-color)',
        hover: 'var(--hover-bg-color)',
        // warm 色系
        warm: {
          bg: '#faf8f4',
          card: '#FFFFFF',
          primary: '#D4A574',
          'primary-hover': '#C89454',
          text: '#3A3A3A',
          'text-secondary': '#8B8680',
          border: '#E8E4DD',
          error: '#D97757',
          success: '#90B494',
        },
      },
      // 字体系列
      fontFamily: {
        sans: [
          'LXGW WenKai Medium',
          'Noto Sans SC',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      // 边框圆角
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        DEFAULT: 'var(--border-radius)',
        half: 'calc(var(--border-radius) / 2)',
        '1.5x': 'calc(var(--border-radius) * 1.5)',
      },
      // 阴影
      boxShadow: {
        DEFAULT: 'var(--box-shadow)',
        card: 'var(--card-shadow)',
        custom:
          '0 10px 30px rgba(0, 0, 0, 0.1), 0 1px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        pomodoro: '0 2px 8px rgba(212, 193, 138, 0.08)',
        'input-focus': '0 0 8px rgba(212, 193, 138, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1)',
        button: '0 2px 6px rgba(212, 193, 138, 0.3)',
        hover: '0 4px 8px rgba(0, 0, 0, 0.05)',
        nav: '0 -2px 10px rgba(0, 0, 0, 0.1)',
      },
      // 背景模糊
      backdropBlur: {
        DEFAULT: '20px',
      },
      // 尺寸扩展
      spacing: {
        4.5: '18px',
        10.5: '42px',
        15: '60px',
        25: '100px',
        30: '120px',
        75: '300px',
        100: '400px',
        125: '500px',
        150: '600px',
      },
      // 最小/最大宽高
      minHeight: {
        50: '200px',
        '70vh': '70vh',
        '75vh': '75vh',
      },
      maxHeight: {
        25: '100px',
        30: '120px',
        32: '128px',
        100: '400px',
        125: '500px',
        150: '600px',
      },
      height: {
        '30vh': '30vh',
        '40vh': '40vh',
        '45vh': '45vh',
      },
      minWidth: {
        12.5: '50px',
        15: '60px',
        20: '80px',
        62.5: '250px',
      },
      maxWidth: {
        75: '300px',
        150: '600px',
        'screen-xl-plus': '1360px',
      },
      width: {
        75: '300px',
      },
      // z-index
      zIndex: {
        1000: '1000',
      },
      // 关键帧动画
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--reka-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--reka-accordion-content-height)' },
          to: { height: '0' },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--reka-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--reka-collapsible-content-height)' },
          to: { height: '0' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(50px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        overlayIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        shake: 'shake 0.3s ease-out',
        overlayIn: 'overlayIn 0.3s ease',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    // 自定义工具类插件
    plugin(({ addUtilities }) => {
      addUtilities({
        // 字体平滑
        '.font-smooth-antialiased': { '-webkit-font-smoothing': 'antialiased' },
        '.font-smooth-subpixel': { '-webkit-font-smoothing': 'subpixel-antialiased' },
        // 滚动条
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05)',
        },
        // 过渡效果
        '.transition-all-300': { transition: 'all 0.3s ease' },
        '.transition-all-500': { transition: 'all 0.5s ease' },
        '.transition-opacity-300': { transition: 'opacity 0.3s ease' },
        '.transition-transform-300': { transition: 'transform 0.3s ease' },
        // 背景渐变
        '.bg-gradient-card': {
          background:
            'linear-gradient(135deg, var(--card-bg-color) 0%, rgba(255, 255, 255, 0.02) 100%)',
        },
        '.bg-gradient-pomodoro': {
          background:
            'linear-gradient(135deg, var(--card-bg-color) 0%, rgba(255, 126, 103, 0.02) 100%)',
        },
        // 变换效果
        '.transform-hover-up': { transform: 'translateY(-2px)' },
        '.transform-hover-up-1': { transform: 'translateY(-1px)' },
        '.transform-hover-up-2': { transform: 'translateY(-2px)' },
        '.transform-hover-up-4': { transform: 'translateY(-4px)' },
        // 背景模糊
        '.backdrop-blur-20': { 'backdrop-filter': 'blur(20px)' },
        // 文本样式
        '.ltr': { direction: 'ltr', 'unicode-bidi': 'isolate', 'text-align': 'left' },
        '.word-break-break-word': { 'word-break': 'break-word', 'overflow-wrap': 'break-word' },
        '.break-words': { 'overflow-wrap': 'break-word', 'word-break': 'break-word' },
        // backface-visibility
        '.backface-visibility-hidden': { 'backface-visibility': 'hidden' },
        // will-change
        '.will-change-transform': { 'will-change': 'transform' },
        // stroke
        '.stroke-round': { 'stroke-linecap': 'round' },
        // 布局
        '.flex-center': {
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
        },
        '.flex-between': {
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
        },
      })
    }),
  ],
}
