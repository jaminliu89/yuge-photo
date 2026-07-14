#!/bin/bash
# deploy.sh — 构建并部署到 Vercel
set -e
cd "$(dirname "$0")"
echo "=== 构建中... ==="
npx astro build
echo "=== 部署中... ==="
npx vercel --prod --yes
echo "=== 完成 ==="
