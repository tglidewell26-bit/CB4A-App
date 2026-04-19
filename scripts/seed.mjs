import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.log("No DATABASE_URL, skipping seed");
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT COUNT(*) AS count FROM books");
    if (Number(rows[0].count) > 0) {
      console.log("Books already exist, skipping seed");
      return;
    }

    const heidiRes = await client.query(
      "INSERT INTO books (title, author, grade) VALUES ($1, $2, $3) RETURNING id",
      ["Heidi", "Johanna Spyri", 3]
    );
    const heidiId = heidiRes.rows[0].id;

    await client.query(
      `INSERT INTO chapters (book_id, num, title, pages, status, date) VALUES
        ($1, 1, 'Going Up to the Alm-Uncle', '1–13', 'ready', 'Apr 5, 2026'),
        ($1, 2, 'At the Grandfather''s', '14–26', 'ready', 'Apr 5, 2026'),
        ($1, 3, 'On the Pasture', '27–38', 'generating', NULL)`,
      [heidiId]
    );

    const treasureRes = await client.query(
      "INSERT INTO books (title, author, grade) VALUES ($1, $2, $3) RETURNING id",
      ["Treasure Island", "Robert Louis Stevenson", 5]
    );
    const treasureId = treasureRes.rows[0].id;

    await client.query(
      `INSERT INTO chapters (book_id, num, title, pages, status, date) VALUES
        ($1, 1, 'The Old Sea-Dog at the Admiral Benbow', '1–11', 'ready', 'Mar 28, 2026')`,
      [treasureId]
    );

    await client.query(
      "INSERT INTO books (title, author, grade) VALUES ($1, $2, $3)",
      ["The Call of the Wild", "Jack London", 7]
    );

    console.log("Seeded 3 sample books with chapters");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
