const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 数据库文件路径
const dbPath = path.join(dataDir, 'heartrate.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('已连接到SQLite数据库');
        initDatabase();
    }
});

// 初始化数据库表
function initDatabase() {
    // 创建场地表
    db.run(`
        CREATE TABLE IF NOT EXISTS venues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('创建场地表失败:', err.message);
        } else {
            console.log('场地表已创建或已存在');
            // 检查是否需要添加默认场地
            db.get('SELECT COUNT(*) as count FROM venues', (err, row) => {
                if (err) {
                    console.error('查询场地表失败:', err.message);
                } else if (row.count === 0) {
                    // 添加默认场地
                    const defaultVenues = [
                        { name: '万众运动（建设街道运动家大厦店）', description: '建设街道运动家大厦店' },
                        { name: '万众运动（云东社区东栅好社区）店', description: '云东社区东栅好社区店' },
                        { name: '万众运动（大桥镇浙江清华长三角研究院店）', description: '大桥镇浙江清华长三角研究院店' },
                        { name: '万众运动（望海街道望海全民健身中心1号馆）', description: '望海街道望海全民健身中心1号馆' },
                        { name: '万众运动（梧桐街道梧桐邻里体育路店）', description: '梧桐街道梧桐邻里体育路店' },
                        { name: '万众运动（梧桐街道校场东路篮球场店）', description: '梧桐街道校场东路篮球场店' },
                        { name: '万众运动（硕石街道北关桥体育公园店）', description: '硕石街道北关桥体育公园店' },
                        { name: '万众运动（硕石街道横头街体育公园店）', description: '硕石街道横头街体育公园店' },
                        { name: '万众运动（硕石街道菊庄路体育公园店）', description: '硕石街道菊庄路体育公园店' },
                        { name: '万众运动（王店镇全民健身中心店）', description: '王店镇全民健身中心店' },
                        { name: '万众运动（高照街道秀洲老年大学店）', description: '高照街道秀洲老年大学店' }
                    ];

                    const stmt = db.prepare('INSERT INTO venues (name, description) VALUES (?, ?)');
                    defaultVenues.forEach(venue => {
                        stmt.run(venue.name, venue.description);
                    });
                    stmt.finalize();
                    console.log('已添加默认场地数据');
                }
            });
        }
    });

    // 创建设备表
    db.run(`
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT UNIQUE NOT NULL,
            room_id TEXT NOT NULL,
            venue_id INTEGER,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (venue_id) REFERENCES venues (id)
        )
    `, (err) => {
        if (err) {
            console.error('创建设备表失败:', err.message);
        } else {
            console.log('设备表已创建或已存在');
        }
    });

    // 创建PK记录表
    db.run(`
        CREATE TABLE IF NOT EXISTS pk_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            venue_id INTEGER,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            participants_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (venue_id) REFERENCES venues (id)
        )
    `, (err) => {
        if (err) {
            console.error('创建PK记录表失败:', err.message);
        } else {
            console.log('PK记录表已创建或已存在');
        }
    });

    // 创建用户表
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            open_id TEXT UNIQUE,
            nickname TEXT,
            avatar_url TEXT,
            gender INTEGER DEFAULT 0, /* 0: 未知, 1: 男, 2: 女 */
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('创建用户表失败:', err.message);
        } else {
            console.log('用户表已创建或已存在');
        }
    });

    // 创建家庭成员表
    db.run(`
        CREATE TABLE IF NOT EXISTS family_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            nickname TEXT NOT NULL,
            gender INTEGER DEFAULT 0, /* 0: 未知, 1: 男, 2: 女 */
            birth_date TEXT,
            relationship TEXT, /* 与用户的关系: 自己, 父亲, 母亲, 子女, 配偶, 其他 */
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `, (err) => {
        if (err) {
            console.error('创建家庭成员表失败:', err.message);
        } else {
            console.log('家庭成员表已创建或已存在');
        }
    });

    // 创建设备使用记录表
    db.run(`
        CREATE TABLE IF NOT EXISTS device_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            user_id INTEGER,
            member_id INTEGER,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices (device_id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (member_id) REFERENCES family_members (id)
        )
    `, (err) => {
        if (err) {
            console.error('创建设备使用记录表失败:', err.message);
        } else {
            console.log('设备使用记录表已创建或已存在');
        }
    });
}

// 获取所有场地
function getAllVenues(callback) {
    db.all('SELECT * FROM venues ORDER BY name', [], (err, rows) => {
        if (err) {
            console.error('获取场地列表失败:', err.message);
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
}

// 根据ID获取场地信息
function getVenueById(venueId, callback) {
    db.get('SELECT * FROM venues WHERE id = ?', [venueId], (err, row) => {
        if (err) {
            console.error('获取场地信息失败:', err.message);
            callback(err, null);
        } else {
            callback(null, row);
        }
    });
}

// 获取所有设备
function getAllDevices(callback) {
    const query = `
        SELECT d.*, v.name as venue_name
        FROM devices d
        LEFT JOIN venues v ON d.venue_id = v.id
        ORDER BY d.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('获取设备列表失败:', err.message);
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
}

// 获取设备信息
function getDeviceByDeviceId(deviceId, callback) {
    const query = `
        SELECT d.*, v.name as venue_name
        FROM devices d
        LEFT JOIN venues v ON d.venue_id = v.id
        WHERE d.device_id = ?
    `;

    db.get(query, [deviceId], (err, row) => {
        if (err) {
            console.error('获取设备信息失败:', err.message);
            callback(err, null);
        } else {
            callback(null, row);
        }
    });
}

// 保存或更新设备信息
function saveDevice(deviceInfo, callback) {
    const { deviceId, roomId, venueId, name } = deviceInfo;

    // 检查设备是否已存在
    db.get('SELECT * FROM devices WHERE device_id = ?', [deviceId], (err, row) => {
        if (err) {
            console.error('查询设备失败:', err.message);
            callback(err, null);
            return;
        }

        if (row) {
            // 更新现有设备
            db.run(
                'UPDATE devices SET room_id = ?, venue_id = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?',
                [roomId, venueId, name, deviceId],
                function(err) {
                    if (err) {
                        console.error('更新设备失败:', err.message);
                        callback(err, null);
                    } else {
                        callback(null, { id: row.id, deviceId, roomId, venueId, name, updated: true });
                    }
                }
            );
        } else {
            // 添加新设备
            db.run(
                'INSERT INTO devices (device_id, room_id, venue_id, name) VALUES (?, ?, ?, ?)',
                [deviceId, roomId, venueId, name],
                function(err) {
                    if (err) {
                        console.error('添加设备失败:', err.message);
                        callback(err, null);
                    } else {
                        callback(null, { id: this.lastID, deviceId, roomId, venueId, name, created: true });
                    }
                }
            );
        }
    });
}

// 记录PK会话开始
function startPKSession(roomId, venueId, callback) {
    db.run(
        'INSERT INTO pk_sessions (room_id, venue_id, start_time) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [roomId, venueId],
        function(err) {
            if (err) {
                console.error('记录PK会话开始失败:', err.message);
                callback(err, null);
            } else {
                callback(null, { id: this.lastID, roomId, venueId });
            }
        }
    );
}

// 记录PK会话结束
function endPKSession(roomId, participantsCount, callback) {
    db.run(
        'UPDATE pk_sessions SET end_time = CURRENT_TIMESTAMP, participants_count = ? WHERE room_id = ? AND end_time IS NULL',
        [participantsCount, roomId],
        function(err) {
            if (err) {
                console.error('记录PK会话结束失败:', err.message);
                callback(err, null);
            } else {
                callback(null, { roomId, updated: this.changes > 0 });
            }
        }
    );
}

// 用户相关操作
// 根据OpenID获取用户
function getUserByOpenId(openId, callback) {
    db.get('SELECT * FROM users WHERE open_id = ?', [openId], (err, row) => {
        if (err) {
            console.error('获取用户信息失败:', err.message);
            callback(err, null);
        } else {
            callback(null, row);
        }
    });
}

// 创建或更新用户
function saveUser(userInfo, callback) {
    const { openId, nickname, avatarUrl, gender } = userInfo;

    // 检查用户是否已存在
    db.get('SELECT * FROM users WHERE open_id = ?', [openId], (err, row) => {
        if (err) {
            console.error('查询用户失败:', err.message);
            callback(err, null);
            return;
        }

        if (row) {
            // 更新现有用户
            db.run(
                'UPDATE users SET nickname = ?, avatar_url = ?, gender = ?, updated_at = CURRENT_TIMESTAMP WHERE open_id = ?',
                [nickname, avatarUrl, gender, openId],
                function(err) {
                    if (err) {
                        console.error('更新用户失败:', err.message);
                        callback(err, null);
                    } else {
                        callback(null, { id: row.id, openId, nickname, avatarUrl, gender, updated: true });
                    }
                }
            );
        } else {
            // 添加新用户
            db.run(
                'INSERT INTO users (open_id, nickname, avatar_url, gender) VALUES (?, ?, ?, ?)',
                [openId, nickname, avatarUrl, gender],
                function(err) {
                    if (err) {
                        console.error('添加用户失败:', err.message);
                        callback(err, null);
                    } else {
                        callback(null, { id: this.lastID, openId, nickname, avatarUrl, gender, created: true });
                    }
                }
            );
        }
    });
}

// 家庭成员相关操作
// 获取用户的所有家庭成员
function getFamilyMembers(userId, callback) {
    db.all('SELECT * FROM family_members WHERE user_id = ? ORDER BY created_at', [userId], (err, rows) => {
        if (err) {
            console.error('获取家庭成员失败:', err.message);
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
}

// 获取单个家庭成员
function getFamilyMember(memberId, callback) {
    db.get('SELECT * FROM family_members WHERE id = ?', [memberId], (err, row) => {
        if (err) {
            console.error('获取家庭成员失败:', err.message);
            callback(err, null);
        } else {
            callback(null, row);
        }
    });
}

// 添加家庭成员
function addFamilyMember(memberInfo, callback) {
    const { userId, nickname, gender, birthDate, relationship } = memberInfo;

    db.run(
        'INSERT INTO family_members (user_id, nickname, gender, birth_date, relationship) VALUES (?, ?, ?, ?, ?)',
        [userId, nickname, gender, birthDate, relationship],
        function(err) {
            if (err) {
                console.error('添加家庭成员失败:', err.message);
                callback(err, null);
            } else {
                callback(null, { id: this.lastID, userId, nickname, gender, birthDate, relationship, created: true });
            }
        }
    );
}

// 更新家庭成员
function updateFamilyMember(memberId, memberInfo, callback) {
    const { nickname, gender, birthDate, relationship } = memberInfo;

    db.run(
        'UPDATE family_members SET nickname = ?, gender = ?, birth_date = ?, relationship = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nickname, gender, birthDate, relationship, memberId],
        function(err) {
            if (err) {
                console.error('更新家庭成员失败:', err.message);
                callback(err, null);
            } else {
                callback(null, { id: memberId, nickname, gender, birthDate, relationship, updated: this.changes > 0 });
            }
        }
    );
}

// 删除家庭成员
function deleteFamilyMember(memberId, callback) {
    db.run('DELETE FROM family_members WHERE id = ?', [memberId], function(err) {
        if (err) {
            console.error('删除家庭成员失败:', err.message);
            callback(err, null);
        } else {
            callback(null, { id: memberId, deleted: this.changes > 0 });
        }
    });
}

// 设备使用记录相关操作
// 记录设备使用开始
function startDeviceUsage(usageInfo, callback) {
    const { deviceId, userId, memberId } = usageInfo;

    db.run(
        'INSERT INTO device_usage (device_id, user_id, member_id, start_time) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [deviceId, userId, memberId],
        function(err) {
            if (err) {
                console.error('记录设备使用开始失败:', err.message);
                callback(err, null);
            } else {
                callback(null, { id: this.lastID, deviceId, userId, memberId, created: true });
            }
        }
    );
}

// 记录设备使用结束
function endDeviceUsage(usageId, callback) {
    db.run(
        'UPDATE device_usage SET end_time = CURRENT_TIMESTAMP WHERE id = ? AND end_time IS NULL',
        [usageId],
        function(err) {
            if (err) {
                console.error('记录设备使用结束失败:', err.message);
                callback(err, null);
            } else {
                callback(null, { id: usageId, updated: this.changes > 0 });
            }
        }
    );
}

// 获取用户的设备使用记录
function getUserDeviceUsage(userId, callback) {
    const query = `
        SELECT du.*, d.name as device_name, fm.nickname as member_name
        FROM device_usage du
        LEFT JOIN devices d ON du.device_id = d.device_id
        LEFT JOIN family_members fm ON du.member_id = fm.id
        WHERE du.user_id = ?
        ORDER BY du.start_time DESC
    `;

    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('获取用户设备使用记录失败:', err.message);
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
}

// 关闭数据库连接
function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('关闭数据库连接失败:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
    });
}

// 导出数据库操作函数
module.exports = {
    getAllVenues,
    getVenueById,
    getAllDevices,
    getDeviceByDeviceId,
    saveDevice,
    startPKSession,
    endPKSession,
    getUserByOpenId,
    saveUser,
    getFamilyMembers,
    getFamilyMember,
    addFamilyMember,
    updateFamilyMember,
    deleteFamilyMember,
    startDeviceUsage,
    endDeviceUsage,
    getUserDeviceUsage,
    closeDatabase
};
