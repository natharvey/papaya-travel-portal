#!/bin/bash
# deploy.sh — build, push and deploy Papaya to AWS ECS
# Usage:
#   ./deploy.sh          — deploy both API and web
#   ./deploy.sh api      — deploy API only
#   ./deploy.sh web      — deploy web only

set -e

AWS_ACCOUNT="095523580645"
AWS_REGION="us-east-1"
ECR_BASE="$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
ECS_CLUSTER="papaya-cluster"
ECS_SERVICE="papaya-service"
TASK_FAMILY="papaya"

TARGET="${1:-both}"

echo "==> Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_BASE

build_api() {
  echo ""
  echo "==> Building API image (linux/amd64)..."
  docker build --platform linux/amd64 -t papaya-api ./api
  docker tag papaya-api:latest $ECR_BASE/papaya-api:latest
  echo "==> Pushing API image..."
  docker push $ECR_BASE/papaya-api:latest
}

build_web() {
  echo ""
  echo "==> Building web image (linux/amd64)..."
  docker build --platform linux/amd64 -t papaya-web ./web
  docker tag papaya-web:latest $ECR_BASE/papaya-web:latest
  echo "==> Pushing web image..."
  docker push $ECR_BASE/papaya-web:latest
}

if [[ "$TARGET" == "api" ]]; then
  build_api
elif [[ "$TARGET" == "web" ]]; then
  build_web
else
  build_api
  build_web
fi

echo ""
echo "==> Registering new task definition..."
REVISION=$(aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --query 'taskDefinition.revision' \
  --output text)
echo "    Task definition: $TASK_FAMILY:$REVISION"

echo "==> Deploying to ECS ($ECS_CLUSTER / $ECS_SERVICE)..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE \
  --task-definition $TASK_FAMILY:$REVISION \
  --force-new-deployment \
  --output json > /dev/null

echo ""
echo "✓ Deployment triggered. New task starting up (~1-2 mins)."
echo "  Monitor: https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/$ECS_CLUSTER/services/$ECS_SERVICE"
