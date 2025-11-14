This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Keyword Generation

This app uses Google Gemini API to generate descriptive keywords for each icon image, enabling semantic search functionality.

### Setup

1. **Get a Gemini API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/) to get your API key
   - Create a `.env.local` file in the root directory:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

### Generating Keywords

The keyword generation script processes all icon images and generates descriptive keywords using the Gemini API.

**Test Run (5 images):**
```bash
npm run generate-keywords:test
```

**Custom Limit:**
```bash
npx tsx scripts/generate-keywords.ts --limit=100
```

**Full Generation (all ~4,254 images):**
```bash
npm run generate-keywords
```

### How It Works

- The script processes images in batches of 10 (matching the API rate limit of 10 requests/minute)
- Keywords are saved to `keywords.json` in the root directory
- Progress is saved after each batch, so you can safely stop and resume
- Already processed images are automatically skipped on subsequent runs
- The script respects API rate limits with automatic delays between batches

### Expected Duration

- **Test run (5 images)**: ~10 seconds
- **100 images**: ~11 minutes
- **Full generation (~4,254 images)**: ~7.7 hours

### Search Functionality

Once keywords are generated:
- Search works by matching keywords first, then falls back to filename matching
- Keywords are displayed in the icon detail panel
- You can copy keywords for use elsewhere

The `keywords.json` file is automatically loaded when the app starts, so no additional configuration is needed after generation.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
