// Teamwork Graph traversal (Reader side, read-only scopes).
// Primary link source: JSM incident to JSM Assets object, Confluence
// Safety SOP page, and standby team. Mixed traversals return partial
// results by design, so callers fall back to Jira links and Assets AQL
// when the graph has nothing. Failures return null, never throw.

const LINKED_OBJECTS_QUERY = `
query frontbox_linkedObjects($cypherQuery: String!, $params: CypherRequestParams) {
  cypherQuery(query: $cypherQuery, params: $params) {
    edges {
      node {
        columns {
          key
          value {
            __typename
            ... on CypherQueryResultListNode {
              nodes {
                id
                data {
                  __typename
                  ... on ConfluencePage { id title }
                  ... on AtlassianTeam { id displayName }
                  ... on AtlassianUser { id displayName }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const LINKED_OBJECTS_CYPHER =
  'MATCH (issue:JiraWorkItem {ari: $id})--(linked) RETURN collect(distinct linked) as linked';

export async function fetchLinkedObjects(api, issueAri) {
  if (!issueAri) return null;
  try {
    const response = await api.asUser().requestTeamworkGraph(LINKED_OBJECTS_QUERY, {
      cypherQuery: LINKED_OBJECTS_CYPHER,
      params: { parameters: { id: issueAri } },
    });
    const body = await response.json();
    const edges = body?.data?.cypherQuery?.edges ?? [];
    const nodes = [];
    for (const edge of edges) {
      for (const column of edge?.node?.columns ?? []) {
        for (const node of column?.value?.nodes ?? []) {
          nodes.push({ id: node.id, type: node?.data?.__typename ?? 'unknown', data: node?.data ?? {} });
        }
      }
    }
    return nodes.length > 0 ? nodes : null;
  } catch {
    return null;
  }
}

export function pickSopPage(linked) {
  const page = (linked ?? []).find((node) => node.type === 'ConfluencePage');
  if (!page) return null;
  return { pageId: page.data.id ?? page.id, title: page.data.title ?? 'Linked Confluence page' };
}
