#!/bin/bash
# ============================================================
# Configure MinIO → Knative webhook notification
# Run this ONCE after deploying the Knative service.
# Requires: mc (MinIO Client) accessible and myminio alias set.
# ============================================================

# Step 1: Get the Knative service internal URL
# (Run from inside the cluster or use kubectl exec on MinIO pod)
KNATIVE_URL="http://receipt-annotator.urbansync.svc.cluster.local"

echo "🔧 Configuring MinIO webhook → ${KNATIVE_URL}"

# Step 2: Register webhook endpoint with MinIO
mc admin config set myminio notify_webhook:receipts_knative \
    endpoint="${KNATIVE_URL}" \
    queue_limit="100" \
    enable="on"

# Step 3: Restart MinIO to apply config
mc admin service restart myminio
sleep 5
echo "✅ MinIO restarted"

# Step 4: Add event listener on 'receipts' bucket for PUT events
mc event add myminio/receipts \
    arn:minio:sqs::receipts_knative:webhook \
    --event "s3:ObjectCreated:Put"

echo "✅ MinIO → Knative webhook configured"
echo ""
echo "🧪 Test by uploading a file:"
echo "   mc cp test-receipt.jpg myminio/receipts/"
echo "   Then check Knative logs:"
echo "   kubectl logs -l serving.knative.dev/service=receipt-annotator -n urbansync --tail=30"
