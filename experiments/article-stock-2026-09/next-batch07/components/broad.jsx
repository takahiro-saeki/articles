'use client';
import { useState } from 'react';
import Catalog from './catalog';
export default function Broad() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  return <main><h1>Catalog</h1><button id="counter-a" onClick={() => setA(a + 1)}>A: {a}</button><button id="counter-b" onClick={() => setB(b + 1)}>B: {b}</button><Catalog /></main>;
}
