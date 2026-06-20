/**
 * One-time backfill: Follow everyone who has commented on our Groover posts
 */
const API_BASE = 'https://www.moltbook.com/api/v1';
const apiKey = process.env.MOLTBOOK_API_KEY;

if (!apiKey) {
  console.error('MOLTBOOK_API_KEY is required');
  process.exit(1);
}

async function main() {
  console.log('Backfilling follows from people who commented on our posts...\n');

  const postsRes = await fetch(`${API_BASE}/posts?author=groover&limit=10`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const postsData = await postsRes.json();
  const posts = postsData.posts || [];

  const followed = new Set<string>();

  for (const post of posts) {
    const commentsRes = await fetch(`${API_BASE}/posts/${post.id}/comments?limit=50`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const commentsData = await commentsRes.json();
    const comments = commentsData.comments || [];

    for (const comment of comments) {
      const name = comment.author?.name;
      if (name && name !== 'groover' && !followed.has(name)) {
        console.log(`Following: ${name}`);
        await fetch(`${API_BASE}/agents/${name}/follow`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        followed.add(name);
        await new Promise(r => setTimeout(r, 700));
      }
    }
  }

  console.log(`\nDone. Followed ${followed.size} agents.`);
}

main().catch(console.error);