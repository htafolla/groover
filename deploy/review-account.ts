/**
 * review-account.ts
 * 
 * One-time diagnostic to review Groover Moltbook account activity.
 * 
 * Usage:
 *   npx tsx deploy/review-account.ts
 */

const API = 'https://www.moltbook.com/api/v1';
const key = process.env.MOLTBOOK_API_KEY;

if (!key) {
  console.error('MOLTBOOK_API_KEY not set');
  process.exit(1);
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  if (!res.ok) {
    console.error(`Error ${res.status} on ${path}`);
    return null;
  }
  return res.json();
}

async function main() {
  console.log('=== Groover Moltbook Account Review ===\n');

  // Get posts
  const postsData = await get('/posts?author=groover&limit=10');
  const posts = postsData?.posts || [];

  console.log(`Total posts found: ${posts.length}\n`);

  let totalReplies = 0;
  let agentReplies = 0;

  for (const post of posts) {
    console.log('─────────────────────────────────────');
    console.log(`Post: ${post.id}`);
    console.log(`Title: ${post.title}`);
    console.log(`Created: ${post.created_at}`);
    console.log(`Comments: ${post.comment_count}`);
    console.log(`Score: ${post.score}`);

    const commentsData = await get(`/posts/${post.id}/comments?limit=30`);
    const comments = commentsData?.comments || [];

    console.log(`\nReplies (${comments.length} shown):`);

    for (const c of comments) {
      totalReplies++;
      const isAgent = c.author?.name !== 'groover';
      if (isAgent) agentReplies++;

      console.log(`  - [${c.author?.name || 'unknown'}] ${c.content?.slice(0, 90)}${c.content?.length > 90 ? '...' : ''}`);
    }
    console.log('');
  }

  console.log('─────────────────────────────────────');
  console.log('Summary:');
  console.log(`  Total posts:     ${posts.length}`);
  console.log(`  Total replies:   ${totalReplies}`);
  console.log(`  Agent replies:   ${agentReplies}`);
  console.log('─────────────────────────────────────');
}

main().catch(console.error);