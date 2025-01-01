#!/bin/bash

# 设置备份目录
BACKUP_DIR="/www/bendiziyuanku/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_$DATE"

echo "开始备份..."

# 创建备份目录
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# 备份数据库
echo "正在备份数据库..."
cp /www/bendiziyuanku/sync/database/resources.db "$BACKUP_DIR/$BACKUP_NAME/"

# 备份上传的文件
echo "正在备份上传的文件..."
cp -r /www/bendiziyuanku/sync/uploads "$BACKUP_DIR/$BACKUP_NAME/"

# 压缩备份
echo "正在压缩备份..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# 删除7天前的备份
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete

echo "备份完成！备份文件保存在: $BACKUP_DIR/$BACKUP_NAME.tar.gz" 