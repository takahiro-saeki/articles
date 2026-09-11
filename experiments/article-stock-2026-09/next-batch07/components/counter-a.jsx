'use client';
import { useState } from 'react';
export default function CounterA() {
  const [value, setValue] = useState(0);
  return <button id="counter-a" onClick={() => setValue(value + 1)}>A: {value}</button>;
}
