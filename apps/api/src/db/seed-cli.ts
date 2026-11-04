import { connectDb, disconnectDb } from './connection.js';
import { seedCategories } from './seed.js';

await connectDb();
await seedCategories();
await disconnectDb();
