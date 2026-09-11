import { connection } from 'next/server';
export default async function Page() {
  await connection();
  return <pre id="env-result">{JSON.stringify({
    server: process.env.ARTICLE_SERVER_LABEL,
    public: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
  })}</pre>;
}
