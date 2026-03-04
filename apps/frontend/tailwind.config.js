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
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
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
        // UnoCSS 自定义颜色系统 (已迁移至 CSS 变量)
        bg: {
          DEFAULT: 'hsl(var(--background))',
          card: 'hsl(var(--card))',
        },
        text: {
          DEFAULT: 'hsl(var(--text-color))',
          secondary: 'hsl(var(--text-secondary))',
          todo: 'hsl(var(--text-color))',
          completed: 'hsl(var(--todo-completed))',
        },
        'input-custom': {
          bg: 'hsl(var(--card))',
          border: 'hsl(var(--border))',
          focus: 'hsl(var(--ring))',
        },
        button: {
          bg: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          text: 'hsl(var(--primary-foreground))',
        },
        filter: {
          bg: 'hsl(var(--secondary))',
          text: 'hsl(var(--muted-foreground))',
        },
        ai: {
          message: {
            bg: 'hsl(var(--ai-message-bg))',
            border: 'hsl(var(--ai-message-border))',
          },
          accent: {
            hover: 'hsl(var(--ai-accent-hover))',
          },
        },
        language: {
          bg: 'hsl(var(--secondary))',
          color: 'hsl(var(--foreground))',
          hover: 'hsl(var(--accent))',
        },
        project: {
          tag: 'hsl(var(--secondary))',
          'tag-text': 'hsl(var(--secondary-foreground))',
        },
        link: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
        },
        // 语义状态色
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--chart-3))',
        info: 'hsl(var(--chart-2))',
        error: 'hsl(var(--error))',
        hover: 'hsl(var(--accent))',
        // warm 色系 (保持兼容性，但映射到变量)
        warm: {
          bg: 'hsl(var(--background))',
          card: 'hsl(var(--card))',
          primary: 'hsl(var(--primary))',
          'primary-hover': 'hsl(var(--primary-hover))',
          text: 'hsl(var(--text-color))',
          'text-secondary': 'hsl(var(--text-secondary))',
          border: 'hsl(var(--border))',
          error: 'hsl(var(--error))',
          success: 'hsl(var(--success))',
        },
      },
      // 字体系列
      fontFamily: {
        sans: [
          'var(--font-sans)',
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
        xl: 'calc(var(--border-radius) + 4px)',
        lg: 'var(--border-radius)',
        md: 'calc(var(--border-radius) - 2px)',
        sm: 'calc(var(--border-radius) - 4px)',
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
        201: '201px',
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
      transitionTimingFunction: {
        'soft-spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        apple: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      // 关键帧动画
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
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
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
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
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.animate-sparkle': {
          animation: 'sparkle 1.5s ease-in-out infinite',
        },
        '.animate-pulse-custom': {
          animation: 'pulse-custom 2s ease-in-out infinite',
        },
      })
    }),
  ],
}
