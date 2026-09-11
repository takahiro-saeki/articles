'use client';
import { useState } from 'react';
export default function Frame({ children }) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  return <main><h1>Catalog</h1><button id="counter-a" onClick={() => setA(a + 1)}>A: {a}</button><button id="counter-b" onClick={() => setB(b + 1)}>B: {b}</button>{children}</main>;
}
