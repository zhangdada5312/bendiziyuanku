#!/bin/bash

echo "开始部署资源站..."

# 更新系统
echo "正在更新系统..."
sudo apt-get update
sudo apt-get upgrade -y

# 安装必要的软件
echo "正在安装必要的软件..."
sudo apt-get install -y nodejs npm nginx certbot python3-certbot-nginx

# 安装 PM2
echo "正在安装 PM2..."
sudo npm install -g pm2

# 创建项目目录
echo "正在创建项目目录..."
sudo mkdir -p /www/bendiziyuanku
sudo chown -R $USER:$USER /www/bendiziyuanku

# 克隆项目
echo "正在克隆项目..."
cd /www/bendiziyuanku
git clone https://github.com/zhangdada5312/bendiziyuanku.git .

# 安装依赖
echo "正在安装项目依赖..."
npm install

# 创建环境配置
echo "正在创建环境配置..."
echo "PORT=3002" > .env

# 配置 Nginx
echo "正在配置 Nginx..."
sudo bash -c 'cat > /etc/nginx/sites-available/resource-station << EOL
server {
    listen 80;
    server_name $1;  # 将在运行脚本时替换为实际域名

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL'

# 创建 Nginx 配置软链接
sudo ln -s /etc/nginx/sites-available/resource-station /etc/nginx/sites-enabled/

# 测试 Nginx 配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 启动应用
echo "正在启动应用..."
pm2 start backend/server.js --name "resource-station"
pm2 save
pm2 startup

# 配置 SSL
echo "正在配置 SSL..."
sudo certbot --nginx -d $1 --non-interactive --agree-tos --email your-email@example.com

echo "部署完成！" 