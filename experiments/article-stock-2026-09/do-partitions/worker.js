import { DurableObject } from 'cloudflare:workers';

export class Room extends DurableObject {
  /** @param {DurableObjectState} ctx @param {Env} env */
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS member (user_id TEXT PRIMARY KEY)');
    });
  }

  /** @param {string} userId */
  add(userId) {
    this.ctx.storage.sql.exec('INSERT INTO member (user_id) VALUES (?)', userId);
  }

  members() {
    return this.ctx.storage.sql.exec('SELECT user_id FROM member ORDER BY user_id').toArray();
  }
}

/** @param {Env} env @param {string[]} roomIds */
async function collectMembers(env, roomIds) {
  const groups = await Promise.all(roomIds.map(async roomId => {
    const room = env.ROOMS.getByName(`room:${roomId}`);
    const members = await room.members();
    return members.map(member => ({ room_id: roomId, user_id: member.user_id }));
  }));
  return groups.flat().sort((a, b) => a.room_id.localeCompare(b.room_id));
}

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    // A fixed-data local experiment entry point, not an application endpoint.
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    await env.DB.exec('CREATE TABLE membership (room_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (room_id, user_id))');
    await env.DB.batch([
      env.DB.prepare('INSERT INTO membership VALUES (?, ?)').bind('red', 'alice'),
      env.DB.prepare('INSERT INTO membership VALUES (?, ?)').bind('blue', 'bob'),
    ]);
    const red = env.ROOMS.getByName('room:red');
    const blue = env.ROOMS.getByName('room:blue');
    await red.add('alice');
    await blue.add('bob');
    const report = {
      red: await red.members(),
      blue: await blue.members(),
      redFromSameName: await env.ROOMS.getByName('room:red').members(),
      newUniqueObject: await env.ROOMS.get(env.ROOMS.newUniqueId()).members(),
      d1Global: (await env.DB.prepare('SELECT room_id, user_id FROM membership ORDER BY room_id, user_id').all()).results,
      collectedBoth: await collectMembers(env, ['red', 'blue']),
      collectedRedOnly: await collectMembers(env, ['red']),
    };
    return Response.json(report);
  },
};
