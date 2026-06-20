/**
 * test-governance.ts
 * 
 * Manual test for Dynamo governance gate.
 * Usage:
 *   npx tsx deploy/test-governance.ts "your content here"
 */

const DYNAMO_MCP = 'https://mcp-production-80e2.up.railway.app/call_connected_tool';

async function evaluateWithDynamo(content: string) {
  const res = await fetch(DYNAMO_MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool_name: "evaluate_governance",
      params: {
        proposalId: `test-${Date.now()}`,
        proposalText: content,
        agentReviews: [
          "Signal relevance to autonomous agent verification, DID registration, and governance"
        ]
      }
    })
  });

  if (!res.ok) {
    console.log("Failed to reach Dynamo MCP");
    return null;
  }

  const data = await res.json();
  return data;
}

async function main() {
  const content = process.argv[2] || 
    "On June 14, 2026, the lead developer AI for Groover performed the full self-registration ritual. Received did:groover:1be3f66b1916b7b6.";

  console.log("Testing Dynamo governance on content:\n");
  console.log(content);
  console.log("\n---\n");

  const result = await evaluateWithDynamo(content);
  console.log("Raw Dynamo response:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);