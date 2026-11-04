import { logger } from '../lib/logger.js';

/** Paths we never fetch, whatever robots.txt says (PLAN.md section 1). */
const ALWAYS_BLOCKED_PREFIXES = [
  '/search',
  '/company', // also covers /companies
  '/executive', // also covers /executives
  '/my-account',
  '/thank-you',
  '/_next',
  '/sites/',
];

type Rule = { allow: boolean; pattern: RegExp; length: number };

function toPattern(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Parse the rules of the `User-agent: *` group. */
export function parseRobots(text: string): Rule[] {
  const rules: Rule[] = [];
  let inStarGroup = false;
  let sawRule = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (sawRule) inStarGroup = false;
      sawRule = false;
      if (value === '*') inStarGroup = true;
    } else if ((key === 'disallow' || key === 'allow') && inStarGroup) {
      sawRule = true;
      if (value)
        rules.push({ allow: key === 'allow', pattern: toPattern(value), length: value.length });
    }
  }
  return rules;
}

export class RobotsChecker {
  constructor(private readonly rules: Rule[]) {}

  /** True if the URL may be fetched. URLs with a query string are always refused. */
  isAllowed(url: string): boolean {
    const u = new URL(url);
    if (u.search) return false;
    const path = u.pathname;
    if (ALWAYS_BLOCKED_PREFIXES.some((p) => path.startsWith(p))) return false;
    // Longest matching rule wins; allow wins ties (RFC 9309).
    let best: Rule | undefined;
    for (const rule of this.rules) {
      if (!rule.pattern.test(path + u.search)) continue;
      if (!best || rule.length > best.length || (rule.length === best.length && rule.allow))
        best = rule;
    }
    return best ? best.allow : true;
  }
}

export function robotsFromText(text: string): RobotsChecker {
  const rules = parseRobots(text);
  logger.debug({ rules: rules.length }, 'robots.txt parsed');
  return new RobotsChecker(rules);
}
