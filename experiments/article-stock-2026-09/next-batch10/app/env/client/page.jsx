'use client';
import { useEffect, useState } from 'react';
export default function Page() {
  const [values, setValues] = useState(null);
  useEffect(() => {
    const key = 'NEXT_PUBLIC_ARTICLE_LABEL';
    const env = process.env;
    setValues({ direct: process.env.NEXT_PUBLIC_ARTICLE_LABEL,
      dynamic: process.env[key] ?? null, alias: env.NEXT_PUBLIC_ARTICLE_LABEL ?? null,
      server: process.env.ARTICLE_SERVER_LABEL ?? null });
  }, []);
  return <pre id="env-result">{JSON.stringify(values)}</pre>;
}
