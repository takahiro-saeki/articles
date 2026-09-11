import Link from 'next/link';
export default function Home() {
  return <main><h1>Local article experiments</h1><Link href="/cache/router" prefetch={false}>Router probe</Link></main>;
}
