import { vi } from 'vitest';

vi.mock('@inquirer/prompts', () => {
  return {
    confirm: vi.fn(),
    input: vi.fn(),
    select: vi.fn(),
  };
});

vi.mock('ora', () => {
  const spinner = {
    start: vi.fn(() => spinner),
    stop: vi.fn(() => spinner),
    fail: vi.fn(() => spinner),
    succeed: vi.fn(() => spinner),
    info: vi.fn(() => spinner),
    warn: vi.fn(() => spinner),
    text: '',
  };

  return { default: vi.fn(() => spinner) };
});
