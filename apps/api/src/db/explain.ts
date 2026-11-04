import mongoose from 'mongoose';
import { connectDb, disconnectDb } from './connection.js';
import { Article, Author, Category, Tag } from '../models/index.js';

/**
 * Query-plan review. Seeds synthetic articles into a scratch database (never your real one) and
 * explains each query shape the API uses. Run: pnpm --filter @aimag/api db:explain [count]
 */
const URI = 'mongodb://localhost:27017/aimag_perf';
const N = Number(process.argv[2] ?? 30000);
const VISIBLE = { isHidden: false, status: 'published' } as const;
const words =
  'ai model chip startup robot policy cloud agent vision safety data open frontier compute llm gpu inference training ethics'.split(
    ' ',
  );
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

async function seed() {
  await mongoose.connection.dropDatabase();
  await Promise.all([Article, Category, Author, Tag].map((m) => m.init()));
  const cats = await Category.insertMany(
    Array.from({ length: 12 }, (_, i) => ({ name: `Cat ${i}`, slug: `cat-${i}` })),
  );
  const authors = await Author.insertMany(
    Array.from({ length: 300 }, (_, i) => ({ name: `Author ${i}`, slug: `author-${i}` })),
  );
  const tags = await Tag.insertMany(
    Array.from({ length: 200 }, (_, i) => ({ name: `Tag ${i}`, slug: `tag-${i}` })),
  );
  const now = Date.now();
  for (let start = 0; start < N; start += 5000) {
    await Article.insertMany(
      Array.from({ length: Math.min(5000, N - start) }, (_, j) => {
        const i = start + j;
        const hidden = i % 50 === 0;
        return {
          title: `${pick(words)} ${pick(words)} ${pick(words)} story ${i}`,
          slug: `story-${i}`,
          excerpt: Array.from({ length: 20 }, () => pick(words)).join(' '),
          category: pick(cats)._id,
          author: pick(authors)._id,
          tags: Array.from({ length: Math.floor(Math.random() * 4) }, () => pick(tags)._id),
          sourceUrl: `https://aimagazine.com/news/story-${i}`,
          sourceHash: `h${i}`,
          publishedAt: new Date(now - Math.random() * 3 * 365 * 24 * 3600 * 1000),
          isFeatured: i % 200 === 0,
          isHidden: hidden,
          status: hidden ? 'hidden' : 'published',
          viewCount: Math.floor(Math.random() * 1000),
        };
      }),
    );
  }
  return { cat: cats[0]!, author: authors[0]!, tag: tags[0]! };
}

type Stage = { stage: string; inputStage?: Stage; inputStages?: Stage[] };
const stagesOf = (p: Stage): string[] => [
  p.stage,
  ...(p.inputStage ? stagesOf(p.inputStage) : []),
  ...(p.inputStages ?? []).flatMap(stagesOf),
];
const indexOf = (p: Stage): string | undefined =>
  (p as { indexName?: string }).indexName ??
  (p.inputStage ? indexOf(p.inputStage) : p.inputStages?.map(indexOf).find(Boolean));

async function main() {
  await connectDb(URI);
  console.log(`seeding ${N} articles...`);
  const { cat, author, tag } = await seed();
  console.log(`seeded ${await Article.estimatedDocumentCount()} articles\n`);

  const day = 24 * 3600 * 1000;
  const cases: [string, () => { explain: (v: string) => Promise<unknown> }][] = [
    ['home/latest list', () => Article.find(VISIBLE).sort({ publishedAt: -1 }).limit(20)],
    [
      'category list, page 1',
      () =>
        Article.find({ ...VISIBLE, category: cat._id })
          .sort({ publishedAt: -1 })
          .limit(12),
    ],
    [
      'category list, page 100',
      () =>
        Article.find({ ...VISIBLE, category: cat._id })
          .sort({ publishedAt: -1 })
          .skip(1188)
          .limit(12),
    ],
    [
      'tag list',
      () =>
        Article.find({ ...VISIBLE, tags: tag._id })
          .sort({ publishedAt: -1 })
          .limit(12),
    ],
    [
      'author list',
      () =>
        Article.find({ ...VISIBLE, author: author._id })
          .sort({ publishedAt: -1 })
          .limit(12),
    ],
    [
      'sort=popular',
      () => Article.find(VISIBLE).sort({ viewCount: -1, publishedAt: -1 }).limit(12),
    ],
    [
      'featured hero',
      () =>
        Article.find({ ...VISIBLE, isFeatured: true })
          .sort({ publishedAt: -1 })
          .limit(5),
    ],
    [
      'trending (14d by views)',
      () =>
        Article.find({ ...VISIBLE, publishedAt: { $gte: new Date(Date.now() - 14 * day) } })
          .sort({ viewCount: -1, publishedAt: -1 })
          .limit(10),
    ],
    [
      'text search',
      () =>
        Article.find(
          { ...VISIBLE, $text: { $search: 'robot chip' } },
          { score: { $meta: 'textScore' } },
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(12),
    ],
    ['article by slug', () => Article.findOne({ slug: 'story-12345' })],
    [
      'related',
      () =>
        Article.find({ ...VISIBLE, _id: { $ne: new mongoose.Types.ObjectId() }, category: cat._id })
          .sort({ publishedAt: -1 })
          .limit(6),
    ],
    [
      'sitemap page 20 (skip 19000)',
      () =>
        Article.find(VISIBLE, 'slug publishedAt scrapedAt')
          .sort({ publishedAt: -1 })
          .skip(19000)
          .limit(1000),
    ],
    [
      'news sitemap (48h)',
      () =>
        Article.find({
          ...VISIBLE,
          publishedAt: { $gte: new Date(Date.now() - 2 * day) },
          'seo.noindex': { $ne: true },
        })
          .sort({ publishedAt: -1 })
          .limit(1000),
    ],
    [
      'dedup lookup by sourceUrl',
      () => Article.findOne({ sourceUrl: 'https://aimagazine.com/news/story-777' }),
    ],
    [
      'known-URLs check ($in 130)',
      () =>
        Article.find(
          {
            sourceUrl: {
              $in: Array.from({ length: 130 }, (_, i) => `https://aimagazine.com/news/story-${i}`),
            },
          },
          'sourceUrl',
        ),
    ],
    ['admin list, all', () => Article.find({}).sort({ publishedAt: -1 }).limit(25)],
    [
      'admin list, hidden only',
      () => Article.find({ isHidden: true }).sort({ publishedAt: -1 }).limit(25),
    ],
  ];

  const rows: string[][] = [];
  let problems = 0;
  for (const [name, build] of cases) {
    const ex = (await build().explain('executionStats')) as {
      queryPlanner: { winningPlan: Stage };
      executionStats: {
        totalDocsExamined: number;
        totalKeysExamined: number;
        nReturned: number;
        executionTimeMillis: number;
      };
    };
    const stages = stagesOf(ex.queryPlanner.winningPlan);
    const es = ex.executionStats;
    const flags: string[] = [];
    if (stages.includes('COLLSCAN')) flags.push('COLLSCAN');
    if (stages.includes('SORT')) flags.push('IN-MEMORY SORT');
    if (es.totalDocsExamined > Math.max(200, es.nReturned * 20))
      flags.push(`examined ${es.totalDocsExamined}`);
    if (flags.length) problems++;
    rows.push([
      name,
      indexOf(ex.queryPlanner.winningPlan) ?? '-',
      String(es.totalKeysExamined),
      String(es.totalDocsExamined),
      String(es.nReturned),
      `${es.executionTimeMillis}ms`,
      flags.join(', ') || 'ok',
    ]);
  }
  const head = ['query', 'index', 'keys', 'docs', 'ret', 'time', 'verdict'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(w[i]!)).join('  ');
  console.log(line(head));
  rows.forEach((r) => console.log(line(r)));
  console.log(`\n${problems} of ${cases.length} queries flagged`);
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}
await main();
