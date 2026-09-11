export default function Page() {
  return <pre id="env-result">{JSON.stringify({
    server: process.env.ARTICLE_SERVER_LABEL,
    public: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
  })}</pre>;
}
