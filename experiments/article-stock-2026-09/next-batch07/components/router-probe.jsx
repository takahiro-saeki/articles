'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function RouterProbe() {
  const router = useRouter();
  return <nav><Link href="/" prefetch={false}>Home</Link><button onClick={() => router.refresh()}>Refresh</button></nav>;
}
