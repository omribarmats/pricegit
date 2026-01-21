# PriceListener MonorepoThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

A price tracking platform with crowdsourced data collection via browser extension.## Getting Started

## StructureFirst, run the development server:

````bash

pricelistener/npm run dev

├── web/                    # Next.js web application# or

├── extension/             # Chrome browser extensionyarn dev

└── shared/               # Shared types and utilities# or

```pnpm dev

# or

## Setupbun dev

```

### Install Dependencies

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

```bash

# Install root dependenciesYou can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

npm install

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

# Install web app dependencies

cd web && npm install && cd ..## Learn More



# Install extension dependenciesTo learn more about Next.js, take a look at the following resources:

cd extension && npm install && cd ..

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

# Install shared dependencies- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

cd shared && npm install && cd ..

```You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!



### Development## Deploy on Vercel



**Run web app:**The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

```bash

npm run dev:webCheck out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

```

**Build extension:**
```bash
npm run dev:extension
```

**Build everything:**
```bash
npm run build
```

## Web App

The Next.js web application where users can search products and view price history.

- **Tech:** Next.js 16, TypeScript, Tailwind CSS, Supabase
- **Port:** http://localhost:3000

## Browser Extension

Chrome extension for capturing prices from any website.

- **Features:** Click-to-select UI, auto-detect stores, IP geolocation
- **Install:** Build extension, then load `extension/dist` folder in Chrome

## Shared

Common TypeScript types and utilities used by both web and extension.

## Deployment

### Web App (Vercel)

1. Push to GitHub
2. In Vercel dashboard, set **Root Directory** to `web/`
3. Deploy

### Extension (Chrome Web Store)

1. Build: `npm run build:extension`
2. Zip `extension/dist` folder
3. Upload to Chrome Web Store Developer Dashboard

# pricelistener

Local Next.js project.

Quick setup:
1. git init
2. git add . && git commit -m "Initial commit"
3. Create a GitHub repo and push:
   - via CLI: `gh repo create <repo-name> --public --source=. --push`
   - or create repo on GitHub and follow the given push commands
````
