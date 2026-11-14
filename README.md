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

## Rute i API

- `/login` – prijava i registracija
- `/lobby` – pregled i stvaranje soba
- `/room/[code]` – čekaonica ili aktivna partija

Postavi `NEXT_PUBLIC_API_URL` u `.env.local` na adresu servera. Za lokalni razvoj koristi vrijednost iz `.env.example`; u produkciji postavi javnu adresu servera umjesto `localhost`.

Za Google prijavu izradi OAuth Client ID tipa **Web application** u Google Cloud Console. Dodaj frontend adresu u **Authorized JavaScript origins** (lokalno `http://localhost:3000`), zatim isti Client ID postavi kao `NEXT_PUBLIC_GOOGLE_CLIENT_ID` u frontend `.env.local` i `GOOGLE_CLIENT_ID` u `server/.env`. Postavi i `FRONTEND_URL` u `server/.env` na adresu frontenda. Nakon promjene env varijabli ponovno pokreni oba servera. OAuth Client Secret nije potreban za ovaj Google Identity Services tok.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
