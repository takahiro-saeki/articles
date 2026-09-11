import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationRouter as newRouter } from '~/server/api/routers/notification';
import { notificationRouter as oldRouter } from '~/server/api/routers/notification-before-multi';
import * as schema from '~/server/db/schema';
vi.mock('~/server/auth', () => ({ auth: vi.fn() }));
vi.mock('~/server/lib/product-analytics', () => ({ recordProductEvent: vi.fn() }));
let client: Client;
let sequence = 0;
beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  await client.executeMultiple(`
    CREATE TABLE "circle-hub_user" (id TEXT PRIMARY KEY, notification_enabled INTEGER NOT NULL DEFAULT 1);
    INSERT INTO "circle-hub_user" (id) VALUES ('user-a');
    CREATE TABLE "circle-hub_push_token" (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "circle-hub_user"(id),
      token TEXT NOT NULL UNIQUE, platform TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
});
afterEach(() => { client.close(); vi.restoreAllMocks(); });
async function tokens() {
  return (await client.execute('SELECT token FROM "circle-hub_push_token" ORDER BY token')).rows.map(r => r.token);
}
describe('old/new server and logout-caller compatibility matrix', () => {
  for (const [server, router] of [['old', oldRouter], ['new', newRouter]] as const) {
    for (const logout of ['all', 'device'] as const) {
      it(`${server} server + ${logout} logout`, async () => {
        const api = router.createCaller({
          db: drizzle(client, { schema }),
          headers: new Headers({ 'cf-connecting-ip': `192.0.2.${++sequence}` }),
          session: { user: { id: 'user-a', name: null, email: null, image: null }, expires: '2099-01-01T00:00:00Z' },
        });
        await api.registerPushToken({ token: 'ios-lab', platform: 'ios' });
        await api.registerPushToken({ token: 'android-lab', platform: 'android' });
        expect(await tokens()).toEqual(server === 'new' ? ['android-lab', 'ios-lab'] : ['android-lab']);
        if (logout === 'all') await api.unregisterAllPushTokens();
        else await api.unregisterPushToken({ token: 'android-lab' });
        expect(await tokens()).toEqual(server === 'new' && logout === 'device' ? ['ios-lab'] : []);
        // Server updates and a new client do not recreate an already deleted row.
        // The iOS registration call is what brings this synthetic destination back.
        await api.registerPushToken({ token: 'ios-lab', platform: 'ios' });
        expect(await tokens()).toEqual(['ios-lab']);
      });
    }
  }
});
