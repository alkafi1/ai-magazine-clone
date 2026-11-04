import { Schema, model } from 'mongoose';

const scrapeRunSchema = new Schema({
  startedAt: { type: Date, default: Date.now },
  finishedAt: Date,
  trigger: { type: String, enum: ['cron', 'manual', 'cli', 'backfill'], required: true },
  status: {
    type: String,
    enum: ['running', 'success', 'partial', 'failed', 'blocked'],
    default: 'running',
  },
  urlsFound: { type: Number, default: 0 },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  durationMs: Number,
});
// Admin list order, and auto-clean of runs older than 90 days (one TTL index serves both).
scrapeRunSchema.index({ startedAt: -1 }, { expireAfterSeconds: 90 * 24 * 3600 });
export const ScrapeRun = model('ScrapeRun', scrapeRunSchema);

const scrapeErrorSchema = new Schema({
  run: { type: Schema.Types.ObjectId, ref: 'ScrapeRun', required: true, index: true },
  url: String,
  stage: { type: String, enum: ['discover', 'fetch', 'parse', 'normalize', 'save'] },
  message: String,
  httpStatus: Number,
  at: { type: Date, default: Date.now },
});
export const ScrapeError = model('ScrapeError', scrapeErrorSchema);
