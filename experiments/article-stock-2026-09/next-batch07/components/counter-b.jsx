'use client';
import { useState } from 'react';
export default function CounterB() {
  const [value, setValue] = useState(0);
  return <button id="counter-b" onClick={() => setValue(value + 1)}>B: {value}</button>;
}
