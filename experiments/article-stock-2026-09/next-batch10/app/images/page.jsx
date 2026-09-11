import Image from 'next/image';
const responsiveStyle = { display: 'block', width: '50vw', height: 'auto' };
export default function Page() {
  return <main>
    <img id="plain" src="/plain.png" alt="Plain test pattern" width={320} height={200} style={responsiveStyle} />
    <Image id="fixed" src="/fixed.png" alt="Fixed candidates" width={320} height={200} style={responsiveStyle} />
    <Image id="responsive" src="/responsive.png" alt="Responsive candidates" width={320} height={200} sizes="50vw" style={responsiveStyle} />
    <div style={{ height: 10000 }} />
    <section id="lazy-pair">
      <img id="lazy-plain" src="/lazy-plain.png" alt="Native lazy test" width={320} height={200} loading="lazy" />
      <Image id="lazy-next" src="/lazy-next.png" alt="Next lazy test" width={320} height={200} />
    </section>
  </main>;
}
