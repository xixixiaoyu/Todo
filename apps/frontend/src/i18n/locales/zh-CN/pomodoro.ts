export const pomodoro = {
  status: {
    idle: '空闲',
    focus: '专注中',
    short_break: '短休',
    long_break: '长休',
  },
  sessions: '已完成 {count} 个番茄',
  focusComplete: '专注结束，休息一下吧！',
  shortBreakComplete: '休息结束，开始专注吧！',
  longBreakComplete: '休息结束，开始专注吧！',
  modes: {
    classic: '经典模式',
    classic_desc: '最常用的专注节奏 (25/5)',
    icebreaker: '破冰模式',
    icebreaker_desc: '快速进入状态 (15/3)',
    flow: '心流模式',
    flow_desc: '深度专注，无缝心流 (52/17)',
    cosmos: '宇宙模式',
    cosmos_desc: '极致沉浸的长时间专注 (90/30)',
  },
} as const
