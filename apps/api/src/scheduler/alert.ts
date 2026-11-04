import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

/** Failure alert hook: logs, and POSTs JSON to ALERT_WEBHOOK_URL if configured. Never throws. */
export async function sendAlert(subject: string, details: Record<string, unknown> = {}) {
  logger.error({ subject, ...details }, 'ALERT');
  if (!config.alertWebhookUrl) return;
  try {
    // `text` works for Slack/Discord-style webhooks; `details` is for generic receivers.
    await axios.post(
      config.alertWebhookUrl,
      { text: `[AI Magazine] ${subject}`, content: `[AI Magazine] ${subject}`, details },
      { timeout: 10_000 },
    );
  } catch (err) {
    logger.warn({ err: String(err) }, 'alert webhook failed');
  }
}
