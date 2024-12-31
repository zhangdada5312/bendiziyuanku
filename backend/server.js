const express = require('express');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const fallbackPort = 3001; // 备用端口

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../sync/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../sync/uploads')));

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // 保留原始文件扩展名
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        // 检查文件类型
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error('只允许上传图片文件！'));
        }
        cb(null, true);
    }
});

// 数据库配置
const db = new sqlite3.Database(path.join(__dirname, '../sync/database/resources.db'), (err) => {
    if (err) {
        console.error('数据库连接失败:', err);
    } else {
        console.log('数据库连接成功');
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movieName TEXT NOT NULL,
        title TEXT,
        imageUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

// API 路由
// 获取资源列表
app.get('/api/resources', (req, res) => {
    const { page = 1, limit = 12, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM resources';
    let countQuery = 'SELECT COUNT(*) as total FROM resources';
    
    if (search) {
        query += ` WHERE movieName LIKE ? OR title LIKE ?`;
        countQuery += ` WHERE movieName LIKE ? OR title LIKE ?`;
        const searchParam = `%${search}%`;
        
        db.get(countQuery, [searchParam, searchParam], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.all(query + ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
                [searchParam, searchParam, limit, offset],
                (err, rows) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({
                        total: row.total,
                        data: rows
                    });
                }
            );
        });
    } else {
        db.get(countQuery, [], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            db.all(query + ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, rows) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({
                        total: row.total,
                        data: rows
                    });
                }
            );
        });
    }
});

// 从标题中提取影视剧名称
function extractMovieName(title) {
    const match = title.match(/《(.+?)》/);
    return match ? match[1] : '';
}

// 上传资源
app.post('/api/resources', upload.array('images'), async (req, res) => {
    try {
        const { movieName } = req.body;
        const titles = req.body.titles ? JSON.parse(req.body.titles) : [];
        const files = req.files || [];

        // 验证：如果有图片，必须有影视剧名称
        if (files.length > 0 && !movieName) {
            return res.status(400).json({ error: '上传图片时必须填写影视剧名称' });
        }

        // 开始数据库事务
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // 插入图片记录
                files.forEach(file => {
                    const imageUrl = `/uploads/${file.filename}`;
                    db.run(
                        'INSERT INTO resources (movieName, imageUrl) VALUES (?, ?)',
                        [movieName, imageUrl],
                        (err) => {
                            if (err) {
                                console.error('插入图片记录失败:', err);
                                reject(err);
                            }
                        }
                    );
                });

                // 插入标题记录
                titles.forEach(title => {
                    const titleMovieName = movieName || extractMovieName(title);
                    if (titleMovieName) {
                        db.run(
                            'INSERT INTO resources (movieName, title) VALUES (?, ?)',
                            [titleMovieName, title],
                            (err) => {
                                if (err) {
                                    console.error('插入标题记录失败:', err);
                                    reject(err);
                                }
                            }
                        );
                    }
                });

                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('提交事务失败:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });

        res.json({
            message: '上传成功',
            movieName,
            titlesCount: titles.length,
            imagesCount: files.length,
            // 返回上传的图片URL列表
            images: files.map(file => ({
                url: `/uploads/${file.filename}`,
                name: file.originalname
            }))
        });
    } catch (error) {
        console.error('上传错误:', error);
        // 回滚事务
        db.run('ROLLBACK');
        res.status(500).json({ error: error.message });
    }
});

// 删除资源
app.delete('/api/resources/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM resources WHERE id = ?', id, (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: '删除成功' });
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message });
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`端口 ${port} 已被占用，尝试使用端口 ${fallbackPort}`);
        // 尝试使用备用端口
        app.listen(fallbackPort, () => {
            console.log(`服务器运行在 http://localhost:${fallbackPort}`);
        });
    } else {
        console.error('服务器启动失败:', err);
    }
}); 