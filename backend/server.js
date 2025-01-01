const express = require('express');
const multer = require('multer');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const xlsx = require('xlsx');

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
        if (file.fieldname === 'xlsx') {
            if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
                return cb(new Error('只允许上传 Excel 文件！'));
            }
        } else if (file.fieldname === 'images') {
            if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
                return cb(new Error('只允许上传图片文件！'));
            }
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
        views INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

// API 路由
// 获取资源列表
app.get('/api/resources', (req, res) => {
    const { page = 1, limit = 12, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let imageQuery = 'SELECT * FROM resources WHERE imageUrl IS NOT NULL';
    let titleQuery = 'SELECT * FROM resources WHERE title IS NOT NULL';
    let countImageQuery = 'SELECT COUNT(*) as total FROM resources WHERE imageUrl IS NOT NULL';
    let countTitleQuery = 'SELECT COUNT(*) as total FROM resources WHERE title IS NOT NULL';
    let params = [];
    let countParams = [];
    
    if (search) {
        const searchCondition = ` AND (movieName LIKE ? OR title LIKE ?)`;
        imageQuery += searchCondition;
        titleQuery += searchCondition;
        countImageQuery += searchCondition;
        countTitleQuery += searchCondition;
        const searchParam = `%${search}%`;
        params = [searchParam, searchParam];
        countParams = [searchParam, searchParam];
    }
    
    // 添加排序和分页
    imageQuery += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    titleQuery += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    // 根据当前视图类型选择查询
    const query = req.query.view === 'titles' ? titleQuery : imageQuery;
    const countQuery = req.query.view === 'titles' ? countTitleQuery : countImageQuery;

    db.get(countQuery, countParams, (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        db.all(query, params, (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({
                total: row.total,
                data: rows,
                page: parseInt(page),
                limit: parseInt(limit)
            });
        });
    });
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
        let titles = req.body.titles ? JSON.parse(req.body.titles) : [];
        const files = req.files || [];

        // 如果titles是字符串数组，转换为对象数组
        titles = titles.map(title => {
            if (typeof title === 'string') {
                return { title: title, views: 0 };
            }
            return title;
        });

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
                    const titleText = typeof title === 'string' ? title : title.title;
                    const views = typeof title === 'string' ? 0 : (title.views || 0);
                    const titleMovieName = movieName || extractMovieName(titleText);
                    
                    if (titleMovieName) {
                        db.run(
                            'INSERT INTO resources (movieName, title, views) VALUES (?, ?, ?)',
                            [titleMovieName, titleText, views],
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
            imagesCount: files.length
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

// 处理XLSX上传
app.post('/api/upload-xlsx', upload.single('xlsx'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未找到上传的文件' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, { 
            header: 1,  // 使用数组格式
            raw: false  // 确保所有值都被转换为字符串
        });

        // 删除临时文件
        fs.unlinkSync(req.file.path);

        // 处理每一行数据
        const titles = data.filter(row => row && row[0] && row[0].trim());

        // 开始数据库事务
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // 插入每个标题作为独立记录
                titles.forEach(row => {
                    const title = row[0].trim();
                    const views = parseInt(row[1]) || 0;
                    const movieName = extractMovieName(title);
                    
                    if (movieName) {
                        db.run(
                            'INSERT INTO resources (movieName, title, views) VALUES (?, ?, ?)',
                            [movieName, title, views],
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
            titlesCount: titles.length
        });
    } catch (error) {
        console.error('处理XLSX文件失败:', error);
        // 回滚事务
        db.run('ROLLBACK');
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: '处理XLSX文件失败' });
    }
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