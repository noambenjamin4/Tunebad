# Tuner

Tuner is a glassy music utility built with Next.js. It includes file analysis, BPM tools, delay and reverb calculations, pitch conversion, and a direct MP3 download helper.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Add your project URL and anon key.
4. Run `supabase/schema.sql` in the Supabase SQL editor if you want to store analysis results.

The client helper lives in `lib/supabase/client.ts`.

## GitHub

This folder is ready to be initialized and pushed as a GitHub repository.
