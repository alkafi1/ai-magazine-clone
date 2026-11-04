import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

export const objectId = z.string().refine(isValidObjectId, 'invalid id');
export const page = z.coerce.number().int().min(1).max(10_000).default(1);
export const limit = z.coerce.number().int().min(1).max(100).default(20);
/** Escape user text before putting it in a RegExp (search boxes). */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
