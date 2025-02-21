const socket = io();
let username = '';
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const userInfo = document.getElementById('user-info');
const usernameDisplay = document.getElementById('username');
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name');
const remoteAudio = document.getElementById('remote-audio');
let messageIdCounter = 0;
let localStream;
let peerConnection;
const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};

// Modal ve input elemanlarını tanımla
const modal = document.getElementById('username-modal');
const usernameInput = document.getElementById('username-input');
const submitUsernameButton = document.getElementById('submit-username');

// Kullanıcı adı kontrolü
const storedUsername = localStorage.getItem('username');
if (storedUsername) {
    username = storedUsername;
    socket.emit('set_username', username);
    usernameDisplay.textContent = username;
} else {
    modal.style.display = "block";

    submitUsernameButton.addEventListener('click', () => {
        username = usernameInput.value.trim();
        if (username) {
            localStorage.setItem('username', username);
            socket.emit('set_username', username);
            usernameDisplay.textContent = username;
            modal.style.display = "none";
        } else {
            alert("Lütfen geçerli bir kullanıcı adı girin.");
        }
    });
}

// Modal'ı dışarıya tıklanarak kapat
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && username) {
        const timestamp = new Date().toLocaleTimeString();
        messageIdCounter++;
        const messageId = `msg-${messageIdCounter}`;
        socket.emit('message', { username, message, timestamp, messageId });
        messageInput.value = '';
    } else {
        alert('Mesaj ya da kullanıcı adı eksik.');
    }
}

async function startAudioCall() {
    const recipientUsername = prompt("Arama yapmak istediğiniz kullanıcıyı girin:");
    if (recipientUsername) {
        socket.emit('initiate_call', { from: username, to: recipientUsername });
    }
}

function endAudioCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    remoteAudio.srcObject = null;
    document.getElementById('audio-call-text').textContent = "Sesli Arama Sonlandırıldı.";
}

socket.on('initiate_call', async (data) => {
    if (data.to === username) {
        const confirmCall = confirm(`${data.from} sizi arıyor. Aramayı kabul etmek ister misiniz?`);
        if (confirmCall) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                peerConnection = new RTCPeerConnection(configuration);
                peerConnection.addStream(localStream);

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('ice_candidate', { to: data.from, candidate: event.candidate });
                    }
                };

                peerConnection.onaddstream = (event) => {
                    remoteAudio.srcObject = event.stream;
                };

                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                socket.emit('start_audio_call', { from: username, to: data.from, offer });
            } catch (error) {
                console.error('Sesli arama başlatılamadı:', error);
            }
        }
    }
});

socket.on('start_audio_call', async (data) => {
    if (data.to === username) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            peerConnection = new RTCPeerConnection(configuration);
            peerConnection.addStream(localStream);

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice_candidate', { to: data.from, candidate: event.candidate });
                }
            };

            peerConnection.onaddstream = (event) => {
                remoteAudio.srcObject = event.stream;
            };

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer_call', { from: username, to: data.from, answer });
        } catch (error) {
            console.error('Sesli arama cevaplanamadı:', error);
        }
    }
});

socket.on('answer_call', async (data) => {
    if (data.to === username) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

socket.on('ice_candidate', async (data) => {
    if (data.to === username) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('ICE candidate eklenirken hata oluştu:', error);
        }
    }
});

function uploadFile() {
    const file = fileInput.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('Dosya boyutu 5MB\'den büyük olamaz.');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            alert('Sadece JPEG, PNG, GIF, PDF, DOCX ve TXT dosyaları yüklenebilir.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Error: ${data.error}`);
            } else if (data.file_url) {
                const timestamp = new Date().toLocaleTimeString();
                socket.emit('send_file', { file_url: data.file_url, username, timestamp, filename: data.filename });
                fileNameDisplay.textContent = "Hiçbir dosya seçilmedi";
                fileInput.value = '';
            }
        })
        .catch(error => {
            console.error('Dosya yükleme hatası:', error);
            alert('Dosya yüklenirken bir hata oluştu.');
        });
    } else {
        alert('Lütfen bir dosya seçin.');
    }
}

socket.on('message', (msg) => {
    if (msg.username && msg.message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (msg.username === username) {
            messageElement.classList.add('user');
            messageElement.innerHTML = `<strong>${msg.username}</strong> (${msg.timestamp}): ${msg.message} <button onclick="deleteMessage('${msg.messageId}')">Sil</button>`;
        } else {
            messageElement.innerHTML = `<strong>${msg.username}</strong> (${msg.timestamp}): ${msg.message}`;
        }
        messageElement.id = msg.messageId;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

socket.on('send_file', (data) => {
    if (data.username && data.file_url) {
        const fileElement = document.createElement('div');
        fileElement.classList.add('message');
        if (data.username === username) {
            fileElement.classList.add('user');
            fileElement.innerHTML = 
                `<strong>${data.username}</strong> (${data.timestamp}): 
                <button onclick="deleteFile('${data.filename}')">Sil</button>`;
        }

        if (data.file_url.match(/\.(jpeg|jpg|gif|png)$/)) {
            fileElement.innerHTML += `<img src="${data.file_url}" alt="Preview" style="max-width: 100%; height: auto;" onclick="openModal('${data.file_url}')"/>`;
        } else {
            const fileType = data.file_url.split('.').pop().toUpperCase();
            fileElement.innerHTML += `<a href="${data.file_url}" target="_blank" class="file-link"><i class="fas fa-file"></i> ${fileType} Dosyası</a>`;
        }

        fileElement.id = data.filename;
        chatMessages.appendChild(fileElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

function deleteMessage(messageId) {
    socket.emit('delete_message', { messageId });
}

function deleteFile(filename) {
    socket.emit('delete_file', { filename });
}

socket.on('delete_message', (data) => {
    const messageElement = document.getElementById(data.messageId);
    if (messageElement) {
        messageElement.remove();
    }
});

socket.on('delete_file', (data) => {
    const fileElement = document.getElementById(data.filename);
    if (fileElement) {
        fileElement.remove();
    }
});

// Modal açma ve kapama işlemleri
const cikisYapModal = document.getElementById('cikisYapModal');
const cikisYapOnay = document.getElementById('cikisYapOnay');
const cikisYapIptal = document.getElementById('cikisYapIptal');
const cikisYapModalKapat = document.querySelector('.cikisYapModalKapat');

function logout() {
    cikisYapModal.style.display = "block";
}

cikisYapModalKapat.addEventListener('click', () => {
    cikisYapModal.style.display = "none";
});

cikisYapIptal.addEventListener('click', () => {
    cikisYapModal.style.display = "none";
});

cikisYapOnay.addEventListener('click', () => {
    localStorage.removeItem('username');
    window.location.href = '/';
});

function openModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modal-image');
    modal.style.display = "block";
    modalImage.src = imageUrl;
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = "none";
}
