from flask import Flask, send_from_directory
import ssl
import os

app = Flask(__name__)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    # 使用adhoc证书
    app.run(host='0.0.0.0', port=8000, ssl_context='adhoc', debug=True)
