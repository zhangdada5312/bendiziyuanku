const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(
            path.join(__dirname, '../sync/database/resources.db'),
            (err) => {
                if (err) {
                    console.error('数据库连接失败:', err);
                } else {
                    console.log('数据库连接成功');
                    this.init();
                }
            }
        );
    }

    init() {
        const sql = `
            CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movieName TEXT NOT NULL,
                title TEXT,
                imageUrl TEXT,
                views INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.run(sql, (err) => {
            if (err) {
                console.error('创建表失败:', err);
            } else {
                console.log('数据库表初始化成功');
            }
        });
    }

    // 获取所有资源
    getAllResources(page = 1, limit = 12, search = '') {
        return new Promise((resolve, reject) => {
            const offset = (page - 1) * limit;
            let query = 'SELECT * FROM resources';
            let countQuery = 'SELECT COUNT(*) as total FROM resources';
            let params = [];

            if (search) {
                const searchParam = `%${search}%`;
                query += ` WHERE movieName LIKE ? OR title LIKE ?`;
                countQuery += ` WHERE movieName LIKE ? OR title LIKE ?`;
                params = [searchParam, searchParam];
            }

            this.db.get(countQuery, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                const total = row.total;
                this.db.all(
                    query + ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
                    [...params, limit, offset],
                    (err, rows) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve({ total, data: rows });
                    }
                );
            });
        });
    }

    // 添加资源
    addResource(movieName, title, imageUrl, views = 0) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO resources (movieName, title, imageUrl, views) VALUES (?, ?, ?, ?)`;
            this.db.run(sql, [movieName, title, imageUrl, views], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    id: this.lastID,
                    movieName,
                    title,
                    imageUrl,
                    views
                });
            });
        });
    }

    // 删除资源
    deleteResource(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM resources WHERE id = ?`;
            this.db.run(sql, [id], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ message: '删除成功' });
            });
        });
    }

    // 检查重复图片
    checkDuplicateImage(imageHash) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM resources WHERE imageUrl = ?`;
            this.db.get(sql, [imageHash], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row ? true : false);
            });
        });
    }

    // 关闭数据库连接
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

module.exports = new Database(); 