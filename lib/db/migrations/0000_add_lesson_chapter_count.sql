CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"grade" integer NOT NULL,
	"character_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"num" integer,
	"title" text NOT NULL,
	"pages" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"date" text,
	"file" text,
	"extracted_text" text,
	"content" text,
	"workbook_content" text,
	"teacher_guide_content" text,
	"answers_json" text,
	"error_message" text,
	"lesson_chapter_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;