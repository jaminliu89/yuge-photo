#!/bin/bash
# img-upload.sh — 批量上传图片到图床，生成 markdown 引用
# 用法:
#   bash scripts/img-upload.sh photo1.jpg photo2.jpg          # 批量上传
#   bash scripts/img-upload.sh ~/Downloads/系列1/*.jpg         # 上传整个文件夹
#   bash scripts/img-upload.sh --watch ~/Downloads/截图/       # 监听文件夹自动上传

set -e

# ===== 配置 =====
# 选择图床: smms | r2 (r2 需先在 Cloudflare 后台启用)
BED="${IMG_BED:-smms}"

# SM.MS API Token (免费: https://sm.ms/register 获取)
# 匿名上传每天限制 200 张，注册后免费 5GB + 无限制
SMMS_TOKEN="${SMMS_TOKEN:-}"

# R2 配置 (启用后在 Cloudflare 后台绑定域名)
R2_ACCOUNT_ID="e6b844a0248eda1f2072fef3c5c91d15"
R2_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
R2_BUCKET="yuge-photos"

# ===== 颜色输出 =====
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

# ===== 上传函数 =====

upload_smms() {
  local file="$1"
  local filename=$(basename "$file")

  if [ -n "$SMMS_TOKEN" ]; then
    # 带 Token 上传 (无限制)
    resp=$(curl -s -H "Authorization: $SMMS_TOKEN" \
      -F "smfile=@$file" https://sm.ms/api/v2/upload)
  else
    # 匿名上传 (每天 200 张)
    resp=$(curl -s -F "smfile=@$file" https://sm.ms/api/v2/upload)
  fi

  local code=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code','error'))" 2>/dev/null)

  if [ "$code" = "success" ]; then
    local url=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['url'])" 2>/dev/null)
    local hash=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['hash'])" 2>/dev/null)
    echo "$url|$hash"
  elif [ "$code" = "image_repeated" ]; then
    # 图片已存在，返回之前的 URL
    local url=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['images'])" 2>/dev/null)
    echo "$url|repeated"
  else
    echo "ERROR|$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','unknown'))" 2>/dev/null)"
  fi
}

upload_r2() {
  local file="$1"
  local filename=$(basename "$file")
  local key="photos/$(date +%Y%m)/$filename"

  if [ -z "$R2_TOKEN" ]; then
    echo "ERROR|R2 token not set (CLOUDFLARE_API_TOKEN)"
    return
  fi

  # 通过 Cloudflare API 上传到 R2
  resp=$(curl -s -X PUT \
    -H "Authorization: Bearer $R2_TOKEN" \
  -H "Content-Type: $(file --mime-type -b "$file" 2>/dev/null || echo 'image/jpeg')" \
    --data-binary "@$file" \
    "https://api.cloudflare.com/client/v4/accounts/$R2_ACCOUNT_ID/r2/buckets/$R2_BUCKET/objects/$key")

  local success=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)

  if [ "$success" = "True" ]; then
    # 需要绑定域名才能公开访问
    # 假设绑定了 images.yuge-photo.com
    echo "https://images.yuge-photo.com/$key|r2"
  else
    echo "ERROR|$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('errors',[{}])[0].get('message',''))" 2>/dev/null)"
  fi
}

# ===== 批量上传 =====

upload_batch() {
  local files=("$@")
  local total=${#files[@]}
  local success=0 fail=0

  echo -e "\n${GREEN}=== 批量上传到 $BED 图床 ===${NC}"
  echo "共 $total 张图片"
  echo ""

  # 生成 markdown 合集
  local md_file="images-$(date +%Y%m%d%H%M%S).md"

  for i in "${!files[@]}"; do
    local file="${files[$i]}"
    local filename=$(basename "$file")

    # 检查文件
    if [ ! -f "$file" ]; then
      echo -e "  ${YELLOW}[$((i+1))/$total] 跳过: $filename (不存在)${NC}"
      continue
    fi

    # 检查文件大小 (SM.MS 限制 5MB)
    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    if [ "$size" -gt 5242880 ] && [ "$BED" = "smms" ]; then
      echo -e "  ${YELLOW}[$((i+1))/$total] 跳过: $filename (超过 5MB, SM.MS 限制)${NC}"
      continue
    fi

    echo -ne "  ${GREEN}[$((i+1))/$total]${NC} 上传: $filename ... "

    # 上传
    if [ "$BED" = "smms" ]; then
      result=$(upload_smms "$file")
    elif [ "$BED" = "r2" ]; then
      result=$(upload_r2 "$file")
    fi

    local url=$(echo "$result" | cut -d'|' -f1)
    local status=$(echo "$result" | cut -d'|' -f2)

    if [ "$status" = "repeated" ] || [ "$status" = "r2" ] || [[ "$url" == http* ]]; then
      echo -e "${GREEN}✓${NC}"
      # 写入 markdown 文件
      echo "![${filename%.*}]($url)" >> "$md_file"
      echo "" >> "$md_file"
      # 复制最新 URL 到剪贴板
      echo "$url" | pbcopy 2>/dev/null
      ((success++))
    else
      echo -e "${RED}✗ $url${NC}"
      ((fail++))
    fi
  done

  # 结果
  echo ""
  echo -e "${GREEN}=== 完成 ===${NC}"
  echo "成功: $success | 失败: $fail"

  if [ -f "$md_file" ]; then
    echo ""
    echo "Markdown 已生成: $md_file"
    echo "直接复制到文章中使用"
    echo ""
    echo "--- 预览 ---"
    head -6 "$md_file"
  fi

  # 写入文章模板
  if [ $success -gt 0 ]; then
    echo ""
    local series_name=$(basename "$(pwd)")
    echo "=== 文章模板 ==="
    echo "---"
    echo "title: '系列名称'"
    echo "description: '系列描述'"
    echo "date: $(date +%Y-%m-%d)"
    echo "category: composition"
    echo "level: 入门"
    echo "tags: []"
    echo "---"
    echo ""
    echo "本系列共 $success 张作品："
    echo ""
    cat "$md_file"
  fi
}

# ===== Watch 模式 =====
watch_mode() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    echo "目录不存在: $dir"
    exit 1
  fi
  echo -e "${GREEN}监听中: $dir${NC}"
  echo "有新图片出现时自动上传..."
  echo "按 Ctrl+C 停止"

  # 使用 fswatch (macOS 内置) 或 polling
  if command -v fswatch &>/dev/null; then
    fswatch -0 "$dir" | while read -d "" event; do
      local file="$event"
      local ext="${file##*.}"
      case "$ext" in
        jpg|jpeg|png|gif|webp|heic)
          upload_batch "$file"
          ;;
      esac
    done
  else
    # fallback: polling 每 3 秒
    declare seen=""
    while true; do
      for f in "$dir"/*.jpg "$dir"/*.jpeg "$dir"/*.png "$dir"/*.gif "$dir"/*.webp "$dir"/*.heic; do
        [ -f "$f" ] || continue
        sig=$(md5 -q "$f" 2>/dev/null || md5sum "$f" 2>/dev/null | cut -d' ' -f1)
        if ! echo "$seen" | grep -q "$sig"; then
          seen="$seen $sig"
          upload_batch "$f"
        fi
      done
      sleep 3
      sleep 3
    done
  fi
}

# ===== 主入口 =====

# 检查依赖
for cmd in curl python3; do
  if ! command -v $cmd &>/dev/null; then
    echo "缺少依赖: $cmd"
    exit 1
  fi
done

# 检查参数
if [ "$1" = "--watch" ] || [ "$1" = "-w" ]; then
  if [ -z "$2" ]; then
    echo "请指定监听目录: bash scripts/img-upload.sh --watch ~/Downloads/照片/"
    exit 1
  fi
  watch_mode "$2"
elif [ $# -eq 0 ]; then
  echo "用法:"
  echo "  bash scripts/img-upload.sh photo1.jpg photo2.jpg ...  # 批量上传"
  echo "  bash scripts/img-upload.sh ~/Downloads/*.jpg          # 上传整个目录"
  echo "  bash scripts/img-upload.sh --watch ~/Downloads/截图/ # 监听模式"
  echo ""
  echo "环境变量:"
  echo "  IMG_BED=smms         # 图床: smms (默认) | r2"
  echo "  SMMS_TOKEN=xxxxx     # SM.MS Token (注册后免费获取)"
  echo "  CLOUDFLARE_API_TOKEN= # R2 Token"
  exit 0
else
  upload_batch "$@"
fi
