#!/usr/bin/env bash
# Seed a demo PENDING request so the Requests queue has content on a fresh instance.
# (Real requests come from the Scaffolder flow in P2; this is a dev convenience.)
set -euo pipefail
DBNAME="backstage_plugin_platform-requests"
docker exec backstage-postgres-1 psql -U backstage -d "$DBNAME" -c "
INSERT INTO platform_requests (kind,resource_type,resource_name,params,state,policy,requester,created_at,updated_at)
SELECT 'CREATE','database','demo-orders','{\"region\":\"eu-west-1\"}','PENDING_APPROVAL','{\"mode\":\"SINGLE\"}','requester', now()::text, now()::text
WHERE NOT EXISTS (SELECT 1 FROM platform_requests WHERE resource_name='demo-orders');
" >/dev/null
echo "seeded demo request (if absent)"
