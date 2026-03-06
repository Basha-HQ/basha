/**
 * Bot lifecycle types — mirrors Recall.ai's bot state machine.
 *
 * State flow:
 *   idle → joining → in_meeting → recording → leaving → processing → completed
 *                                                                   ↘ failed
 */

export type BotStatus =
  | 'idle'
  | 'joining'
  | 'in_meeting'
  | 'recording'
  | 'leaving'
  | 'processing'
  | 'completed'
  | 'failed';

export interface Bot {
  id: string;
  meeting_id: string;
  meeting_url: string;
  recall_bot_id?: string;
  status: BotStatus;
  error?: string;
  created_at: string;
  updated_at: string;
}

/** Human-readable labels for each bot status */
export const BOT_STATUS_LABEL: Record<BotStatus, string> = {
  idle: 'Initializing',
  joining: 'Joining meeting…',
  in_meeting: 'In meeting',
  recording: 'Recording audio',
  leaving: 'Leaving meeting',
  processing: 'Transcribing & translating',
  completed: 'Done',
  failed: 'Failed',
};

/** Whether a status represents an active (non-terminal) bot */
export function isBotActive(status: BotStatus): boolean {
  return !['completed', 'failed'].includes(status);
}
