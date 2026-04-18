import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { booksTable, chaptersTable } from "./src/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.log("No DATABASE_URL, skipping seed");
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  const existing = await db.select().from(booksTable).limit(1);
  if (existing.length > 0) {
    console.log("Books already exist, skipping seed");
    return;
  }

  const [heidi] = await db.insert(booksTable).values({ title: "Heidi", author: "Johanna Spyri", grade: 3 }).returning();
  await db.insert(chaptersTable).values([
    { bookId: heidi.id, num: 1, title: "Going Up to the Alm-Uncle", pages: "1–13", status: "ready", date: "Apr 5, 2026" },
    { bookId: heidi.id, num: 2, title: "At the Grandfather's", pages: "14–26", status: "ready", date: "Apr 5, 2026" },
    { bookId: heidi.id, num: 3, title: "On the Pasture", pages: "27–38", status: "generating" },
  ]);

  const [treasure] = await db.insert(booksTable).values({ title: "Treasure Island", author: "Robert Louis Stevenson", grade: 5 }).returning();
  await db.insert(chaptersTable).values([
    { bookId: treasure.id, num: 1, title: "The Old Sea-Dog at the Admiral Benbow", pages: "1–11", status: "ready", date: "Mar 28, 2026" },
  ]);

  await db.insert(booksTable).values({ title: "The Call of the Wild", author: "Jack London", grade: 7 });

  console.log("Seeded 3 sample books with chapters");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
