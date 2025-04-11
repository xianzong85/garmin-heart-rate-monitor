const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 检查OpenSSL是否可用
try {
    execSync('openssl version');
    console.log('OpenSSL已安装，开始生成证书...');
} catch (error) {
    console.error('错误: 未找到OpenSSL。请安装OpenSSL后再运行此脚本。');
    process.exit(1);
}

// 生成私钥
console.log('生成私钥...');
execSync('openssl genrsa -out key.pem 2048', { cwd: __dirname });

// 生成证书签名请求
console.log('生成证书签名请求...');
execSync('openssl req -new -key key.pem -out csr.pem -subj "/CN=localhost/O=HeartRatePK/C=CN"', { cwd: __dirname });

// 生成自签名证书
console.log('生成自签名证书...');
execSync('openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem', { cwd: __dirname });

// 清理临时文件
console.log('清理临时文件...');
fs.unlinkSync(path.join(__dirname, 'csr.pem'));

console.log('证书生成完成!');
console.log('私钥: ' + path.join(__dirname, 'key.pem'));
console.log('证书: ' + path.join(__dirname, 'cert.pem'));
