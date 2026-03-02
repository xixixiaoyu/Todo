export const pomodoro = {
  status: {
    idle: 'Idle',
    focus: 'Focusing',
    short_break: 'Short Break',
    long_break: 'Long Break',
  },
  sessions: '{count} sessions completed',
  focusComplete: 'Focus session finished, take a break!',
  shortBreakComplete: 'Break finished, time to focus!',
  longBreakComplete: 'Long break finished, time to focus!',
  modes: {
    classic: 'Classic',
    classic_desc: 'Standard focus rhythm (25/5)',
    icebreaker: 'Icebreaker',
    icebreaker_desc: 'Quick start to focus (15/3)',
    flow: 'Flow',
    flow_desc: 'Deep focus, seamless flow (52/17)',
    cosmos: 'Cosmos',
    cosmos_desc: 'Long, immersive focus sessions (90/30)',
  },
} as const
