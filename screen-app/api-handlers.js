const url = require('url');
const db = require('./database');

// 用户相关API处理
function handleUserApi(req, res, pathname) {
    // 获取用户信息
    if (pathname === '/api/user' && req.method === 'GET') {
        const parsedUrl = url.parse(req.url, true);
        const openId = parsedUrl.query.openId;

        if (!openId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少openId参数' }));
            return true;
        }

        db.getUserByOpenId(openId, (err, user) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '获取用户信息失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ user }));
            }
        });
        return true;
    }

    // 保存用户信息
    if (pathname === '/api/user' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let userInfo;
            try {
                userInfo = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!userInfo.openId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少必要参数' }));
                return;
            }

            db.saveUser(userInfo, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '保存用户信息失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, user: result }));
                }
            });
        });
        return true;
    }

    return false;
}

// 家庭成员相关API处理
function handleFamilyMemberApi(req, res, pathname) {
    // 获取用户的家庭成员
    if (pathname === '/api/family-members' && req.method === 'GET') {
        const parsedUrl = url.parse(req.url, true);
        const userId = parsedUrl.query.userId;

        if (!userId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少userId参数' }));
            return true;
        }

        db.getFamilyMembers(userId, (err, members) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '获取家庭成员失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ members }));
            }
        });
        return true;
    }

    // 添加家庭成员
    if (pathname === '/api/family-member' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let memberInfo;
            try {
                memberInfo = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!memberInfo.userId || !memberInfo.nickname) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少必要参数' }));
                return;
            }

            db.addFamilyMember(memberInfo, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '添加家庭成员失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, member: result }));
                }
            });
        });
        return true;
    }

    // 更新家庭成员
    if (pathname === '/api/family-member' && req.method === 'PUT') {
        const parsedUrl = url.parse(req.url, true);
        const memberId = parsedUrl.query.id;

        if (!memberId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少成员ID参数' }));
            return true;
        }

        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let memberInfo;
            try {
                memberInfo = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!memberInfo.nickname) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少必要参数' }));
                return;
            }

            db.updateFamilyMember(memberId, memberInfo, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '更新家庭成员失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, member: result }));
                }
            });
        });
        return true;
    }

    // 删除家庭成员
    if (pathname === '/api/family-member' && req.method === 'DELETE') {
        const parsedUrl = url.parse(req.url, true);
        const memberId = parsedUrl.query.id;

        if (!memberId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少成员ID参数' }));
            return true;
        }

        db.deleteFamilyMember(memberId, (err, result) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '删除家庭成员失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, result }));
            }
        });
        return true;
    }

    return false;
}

// 设备使用记录相关API处理
function handleDeviceUsageApi(req, res, pathname) {
    // 开始设备使用
    if (pathname === '/api/device-usage/start' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let usageInfo;
            try {
                usageInfo = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!usageInfo.deviceId || !usageInfo.userId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少必要参数' }));
                return;
            }

            db.startDeviceUsage(usageInfo, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '记录设备使用开始失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, usage: result }));
                }
            });
        });
        return true;
    }

    // 结束设备使用
    if (pathname === '/api/device-usage/end' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            let data;
            try {
                data = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '无效的JSON格式' }));
                return;
            }

            if (!data.usageId) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: '缺少必要参数' }));
                return;
            }

            db.endDeviceUsage(data.usageId, (err, result) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: '记录设备使用结束失败' }));
                } else {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, result }));
                }
            });
        });
        return true;
    }

    // 获取用户的设备使用记录
    if (pathname === '/api/device-usage' && req.method === 'GET') {
        const parsedUrl = url.parse(req.url, true);
        const userId = parsedUrl.query.userId;

        if (!userId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少userId参数' }));
            return true;
        }

        db.getUserDeviceUsage(userId, (err, usages) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: '获取设备使用记录失败' }));
            } else {
                res.writeHead(200);
                res.end(JSON.stringify({ usages }));
            }
        });
        return true;
    }

    return false;
}

module.exports = {
    handleUserApi,
    handleFamilyMemberApi,
    handleDeviceUsageApi
};
