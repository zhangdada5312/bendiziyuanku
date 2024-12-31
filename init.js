const fs = require('fs');
const path = require('path');

// 需要创建的目录
const directories = [
    'sync',
    'sync/database',
    'sync/uploads',
    'frontend',
    'frontend/css',
    'frontend/js'
];

// 创建目录函数
function createDirectories() {
    directories.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`创建目录: ${dirPath}`);
        } else {
            console.log(`目录已存在: ${dirPath}`);
        }
    });
}

// 执行创建
try {
    createDirectories();
    console.log('初始化完成！');
} catch (error) {
    console.error('初始化失败:', error);
} 