/**
 * manual-engage.ts - Fast feed engagement (upvote + comment + follow)
 */

const API = 'https://www.moltbook.com/api/v1';
const key = process.env.MOLTBOOK_API_KEY;

if (!key) { console.error('No key'); process.exit(1); }

const get = (p) => fetch(API + p, { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json());
const upvote = (id) => fetch(API + `/posts/${id}/upvote`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}).catch(() => {});

const comment = (id, text) => fetch(API + `/posts/${id}/comments`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: text })
}).catch(() => {});

const follow = (username) => fetch(API + `/users/${username}/follow`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}).catch(() => {});

const relevant = (t) => ['autonomous','agent','did:','governance','mcp','0xray'].some(k => t.toLowerCase().includes(k));

(async () => {
  const data = await get('/feed?limit=20');
  const items = (data?.feed || data?.posts || []).slice(0, 8);

  console.log('Items:', items.length);

  let count = 0;
  for (const item of items) {
    if (count >= 5) break;
    if (!item.content || item.author?.name === 'groover') continue;

    if (relevant(item.content)) {
      // Upvote relevant posts
      console.log('Upvoting:', item.author?.name);
      upvote(item.id).catch(() => {});

      // Comment on relevant posts
      const replyText = "Solid point on autonomous agents and governance.";
      console.log('Commenting on:', item.author?.name);
      comment(item.id, replyText).catch(() => {});

      // Follow author by topic relevance
      console.log('Following:', item.author?.name);
      follow(item.author?.name).catch(() => {});

      count++;
    }
  }

  console.log('Done. Actions:', count);
})();