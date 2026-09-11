import React, { StrictMode, useEffect, useState } from 'react';
import { trace } from './trace.js';

function Subscription({ room, cleanup }) {
  useEffect(() => {
    const handler = () => trace.events.push(`message:${room}`);
    trace.active.add(handler);
    trace.events.push(`setup:${room}`);
    if (cleanup) {
      return () => {
        trace.active.delete(handler);
        trace.events.push(`cleanup:${room}`);
      };
    }
  }, [room, cleanup]);
  return <output id="room">{room}</output>;
}
export function EffectExperiment({ nested, cleanup }) {
  const [room, setRoom] = useState('A');
  const child = <Subscription room={room} cleanup={cleanup} />;
  return <section>
    <button id="change-room" onClick={() => setRoom('B')}>Change room</button>
    <button id="send-local" onClick={() => { for (const handler of trace.active) handler(); }}>Emit locally</button>
    {nested ? <StrictMode>{child}</StrictMode> : child}
  </section>;
}
