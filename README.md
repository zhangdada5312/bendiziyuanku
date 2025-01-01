# 影视资源库

一个简单高效的影视资源管理系统。

## 功能特点

- 支持图片和标题的批量上传
- 支持 XLSX 文件导入标题
- 支持图片预览和复制
- 支持标题和片名复制
- 支持按影视名称搜索
- 支持查看次数统计

## 部署指南

### 系统要求

- Node.js 14+
- npm 6+
- Nginx
- SSL 证书（可选）

### 快速部署

1. 下载部署脚本：
```bash
wget https://raw.githubusercontent.com/zhangdada5312/bendiziyuanku/main/deploy.sh
chmod +x deploy.sh
```

2. 运行部署脚本（替换 your-domain.com 为您的域名）：
```bash
./deploy.sh your-domain.com
```

### 手动部署步骤

1. 安装必要的软件：
```bash
sudo apt-get update
sudo apt-get install -y nodejs npm nginx
sudo npm install -g pm2
```

2. 克隆项目：
```bash
mkdir -p /www/bendiziyuanku
cd /www/bendiziyuanku
git clone https://github.com/zhangdada5312/bendiziyuanku.git .
```

3. 安装依赖：
```bash
npm install
```

4. 配置环境：
```bash
echo "PORT=3002" > .env
```

5. 启动服务：
```bash
pm2 start backend/server.js --name "resource-station"
pm2 save
pm2 startup
```

### 备份说明

1. 下载备份脚本：
```bash
wget https://raw.githubusercontent.com/zhangdada5312/bendiziyuanku/main/backup.sh
chmod +x backup.sh
```

2. 设置定时备份（每天凌晨2点运行）：
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /www/bendiziyuanku/backup.sh") | crontab -
```

### SSL 证书配置

1. 安装 Certbot：
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

2. 获取证书：
```bash
sudo certbot --nginx -d your-domain.com
```

## 维护指南

### 查看日志

```bash
# 查看应用日志
pm2 logs resource-station

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 更新应用

```bash
cd /www/bendiziyuanku
git pull
npm install
pm2 restart resource-station
```

### 常见问题

1. 如果无法访问网站：
   - 检查防火墙设置
   - 确保端口 80 和 443 已开放
   - 检查 Nginx 配置是否正确

2. 如果上传失败：
   - 检查目录权限
   - 检查磁盘空间
   - 查看应用日志

3. 如果备份失败：
   - 检查磁盘空间
   - 确保备份目录存在
   - 检查备份脚本权限

## 技术支持

如有问题，请提交 Issue 或联系管理员。 