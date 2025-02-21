from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
app.secret_key = 'your_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'pdf', 'doc', 'docx', 'ppt', 'txt'}
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10Mb

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Dosya bulunamadı'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Dosya seçilmedi'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        file_url = f'/static/uploads/{filename}'

        return jsonify({'file_url': file_url, 'filename': filename}), 200

    return jsonify({'error': 'Geçersiz dosya türü'}), 400

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@socketio.on('connect')
def handle_connect():
    print(f"User connected: {request.sid}")

@socketio.on('message')
def handle_message(data):
    print(f"Message received: {data}")
    emit('message', data, broadcast=True)

@socketio.on('send_file')
def handle_send_file(data):
    print(f"File sent: {data}")
    emit('send_file', data, broadcast=True)

@socketio.on('delete_message')
def handle_delete_message(data):
    print(f"Message deleted: {data}")
    emit('delete_message', data, broadcast=True)

    # Also delete the file if it exists
    if 'filename' in data:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], data['filename'])
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"File deleted: {data['filename']}")

@socketio.on('delete_file')
def handle_delete_file(data):
    print(f"File deleted: {data}")
    emit('delete_file', data, broadcast=True)

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], data['filename'])
    if os.path.exists(file_path):
        os.remove(file_path)

@socketio.on('initiate_call')
def handle_initiate_call(data):
    print(f"Call initiated: {data}")
    emit('initiate_call', data, broadcast=True)

@socketio.on('start_audio_call')
def handle_start_audio_call(data):
    print(f"Audio call started: {data}")
    emit('start_audio_call', data, broadcast=True)

@socketio.on('answer_call')
def handle_answer_call(data):
    print(f"Call answered: {data}")
    emit('answer_call', data, broadcast=True)

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    print(f"ICE candidate received: {data}")
    emit('ice_candidate', data, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)