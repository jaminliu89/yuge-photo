#!/bin/bash
# img-import.sh — 导入图片到摄影博客，自动压缩 + 生成 markdown 引用
# 用法: bash img-import.sh ~/Downloads/photo.jpg "照片描述(可选)"

set -e
SRC="$1"
DESC="${2:-摄影作品}"

if [ -z "$SRC" ]; then
  echo "用法: bash img-import.sh <图片路径> [描述]"
  echo "示例: bash img-import.sh ~/Downloads/sunset.jpg '黄金时刻的海面'"
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "文件不存在: $SRC"
  exit 1
fi

# 目标目录
IMG_DIR="$(cd "$(dirname "$0")" && pwd)/public/images"
mkdir -p "$IMG_DIR"

# 生成文件名: 日期-原文件名(小写,去空格)
BASENAME=$(basename "$SRC" | sed 's/ /-/g' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9._-]//g')
EXT="${BASENAME##*.}"
# 统一转 .webp 输出
OUT_NAME="$(date +%Y%m%d)-$(echo "$BASENAME" | sed "s/\.$EXT$//").webp"
OUT_PATH="$IMG_DIR/$OUT_NAME"

echo "=== 导入图片 ==="
echo "源文件: $SRC"
echo "输出: $OUT_PATH"

# 用 sips (macOS 内置) 压缩并转 WebP
# 先转 JPEG 中间格式，再用 cwebp 转 WebP
if command -v cwebp &>/dev/null; then
  # 限制最长边 1600px，质量 80
  sips --resampleWidth 1600 "$SRC" --out /tmp/img-import-temp.jpg &>/dev/null
  cwebp -q 80 /tmp/img-import-temp.jpg -o "$OUT_PATH" &>/dev/null
  rm -f /tmp/img-import-temp.jpg
  echo "转换: sips + cwebp → WebP (1600px宽, 质量80)"
elif command -v convert &>/dev/null; then
  convert "$SRC" -resize 1600x -quality 80 "$OUT_PATH"
  echo "转换: ImageMagick → $OUT_NAME"
else
  # 直接复制，不做压缩
  cp "$SRC" "$OUT_PATH"
  echo "警告: 未安装 cwebp 或 ImageMagick，原图复制"
fi

# 文件大小
SIZE=$(stat -f%z "$OUT_PATH" 2>/dev/null || stat -c%s "$OUT_PATH" 2>/dev/null)
echo "文件大小: $(echo "scale=1; $SIZE/1024" | bc)KB"

# 输出 markdown 引用
REL_PATH="/images/$OUT_NAME"
echo ""
echo "=== 在 markdown 中引用 ==="
echo ""
echo "![$DESC]($REL_PATH)"
echo ""
echo "或用 HTML (可控制尺寸):"
echo '<img src="'$REL_PATH'" alt="'$DESC'" width="800" loading="lazy">'
echo ""

# 写入剪贴板 (macOS)
echo "$REL_PATH" | pbcopy 2>/dev/null && echo "✅ 路径已复制到剪贴板: $REL_PATH"
