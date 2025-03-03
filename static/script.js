const socket = io();
let username = '';
let localStream = null;
let peerConnection = null;

// Enhanced WebRTC configuration with multiple STUN/TURN servers
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
        }
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Browser-specific audio constraints
const audioConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
    }
};

// DOM Elements (unchanged)
const elements = {
    messageInput: document.getElementById('message-input'),
    chatMessages: document.getElementById('chat-messages'),
    userInfo: document.getElementById('user-info'),
    usernameDisplay: document.getElementById('username'),
    fileInput: document.getElementById('file-input'),
    fileNameDisplay: document.getElementById('file-name'),
    remoteAudio: document.getElementById('remote-audio'),
    usernameModal: document.getElementById('username-modal'),
    usernameInput: document.getElementById('username-input'),
    submitUsername: document.getElementById('submit-username'),
    cikisYapModal: document.getElementById('cikisYapModal'),
    cikisYapOnay: document.getElementById('cikisYapOnay'),
    cikisYapIptal: document.getElementById('cikisYapIptal'),
    cikisYapModalKapat: document.querySelector('.cikisYapModalKapat'),
    imageModal: document.getElementById('imageModal'),
    modalImage: document.getElementById('modal-image'),
    audioCallText: document.getElementById('audio-call-text'),
};

let messageIdCounter = 0;

// Input Sanitization (unchanged)
const sanitizeInput = (input) => {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
};

// Modal Management (unchanged)
const toggleModal = (modal, display) => {
    modal.style.display = display ? 'block' : 'none';
};

// Initialize Username (unchanged)
const initUsername = () => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
        username = sanitizeInput(storedUsername);
        socket.emit('set_username', username);
        elements.usernameDisplay.textContent = username;
    } else {
        toggleModal(elements.usernameModal, true);
    }
};

// Handle Username Submission (unchanged)
elements.submitUsername.addEventListener('click', () => {
    const inputUsername = sanitizeInput(elements.usernameInput.value.trim());
    if (inputUsername) {
        username = inputUsername;
        localStorage.setItem('username', username);
        socket.emit('set_username', username);
        elements.usernameDisplay.textContent = username;
        toggleModal(elements.usernameModal, false);
    } else {
        alert('Lütfen geçerli bir kullanıcı adı girin.');
    }
});

// Close Modal on Outside Click (unchanged)
window.addEventListener('click', (event) => {
    if (event.target === elements.usernameModal) {
        toggleModal(elements.usernameModal, false);
    } else if (event.target === elements.cikisYapModal) {
        toggleModal(elements.cikisYapModal, false);
    } else if (event.target === elements.imageModal) {
        toggleModal(elements.imageModal, false);
    }
});

// Send Message (unchanged)
const sendMessage = () => {
    const message = sanitizeInput(elements.messageInput.value.trim());
    if (message && username) {
        const timestamp = new Date().toLocaleTimeString();
        messageIdCounter++;
        const messageId = `msg-${messageIdCounter}`;
        socket.emit('message', { username, message, timestamp, messageId });
        elements.messageInput.value = '';
    } else {
        alert('Mesaj ya da kullanıcı adı eksik.');
    }
};

// Enhanced WebRTC Setup
const setupPeerConnection = (recipient) => {
    peerConnection = new RTCPeerConnection(configuration);

    // Set codec preferences for better compatibility
    const transceiver = peerConnection.getTransceivers()[0];
    if (transceiver && transceiver.setCodecPreferences) {
        const codecs = RTCRtpReceiver.getCapabilities('audio').codecs;
        const preferredCodecs = codecs.filter(codec => 
            codec.mimeType === 'audio/opus' || 
            codec.mimeType === 'audio/PCMU' || 
            codec.mimeType === 'audio/PCMA'
        );
        transceiver.setCodecPreferences(preferredCodecs);
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice_candidate', { to: recipient, candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        elements.remoteAudio.srcObject = event.streams[0];
        elements.remoteAudio.play().catch(e => console.error('Audio play failed:', e));
        elements.audioCallText.textContent = 'Bağlantı Kuruldu!';
    };

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'disconnected' || 
            peerConnection.iceConnectionState === 'failed') {
            endAudioCall();
        }
    };

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });
};

// Enhanced Start Audio Call
const startAudioCall = async () => {
    const recipientUsername = prompt('Arama yapmak istediğiniz kullanıcıyı girin:');
    if (!recipientUsername) return;

    try {
        // Detect iOS and adjust constraints
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const constraints = isIOS ? { audio: true } : audioConstraints;

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        setupPeerConnection(recipientUsername);

        const offerOptions = {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 0,
            voiceActivityDetection: true
        };

        const offer = await peerConnection.createOffer(offerOptions);
        await peerConnection.setLocalDescription(offer);
        socket.emit('initiate_call', { from: username, to: recipientUsername, offer });
        elements.audioCallText.textContent = 'Arama Başlatılıyor...';
    } catch (error) {
        console.error('Sesli arama başlatılamadı:', error);
        alert('Sesli arama başlatılırken bir hata oluştu: ' + error.message);
        endAudioCall();
    }
};

// Enhanced End Audio Call
const endAudioCall = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
        });
        localStream = null;
    }
    if (elements.remoteAudio) {
        elements.remoteAudio.srcObject = null;
        elements.remoteAudio.pause();
    }
    elements.audioCallText.textContent = 'Sesli Arama için Tıkla';
};

// Enhanced Handle Incoming Call
socket.on('initiate_call', async (data) => {
    if (data.to !== username) return;

    const confirmCall = confirm(`${data.from} sizi arıyor. Aramayı kabul etmek ister misiniz?`);
    if (!confirmCall) return;

    try {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const constraints = isIOS ? { audio: true } : audioConstraints;

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        setupPeerConnection(data.from);

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer_call', { from: username, to: data.from, answer });
        elements.audioCallText.textContent = 'Arama Kabul Edildi...';
    } catch (error) {
        console.error('Sesli arama cevaplanamadı:', error);
        alert('Arama cevaplanırken bir hata oluştu: ' + error.message);
        endAudioCall();
    }
});

// Handle Call Answer (unchanged)
socket.on('answer_call', async (data) => {
    if (data.to === username) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (error) {
            console.error('Cevap işlenirken hata:', error);
        }
    }
});

// Enhanced ICE Candidate Handling
socket.on('ice_candidate', async (data) => {
    if (data.to === username && peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('ICE candidate eklenirken hata:', error);
        }
    }
});

// File Upload (unchanged)
const uploadFile = async () => {
    const file = elements.fileInput.files[0];
    if (!file) {
        alert('Lütfen bir dosya seçin.');
        return;
    }

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
    elements.fileNameDisplay.textContent = 'Dosya yükleniyor...';

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        const timestamp = new Date().toLocaleTimeString();
        socket.emit('send_file', { file_url: data.file_url, username, timestamp, filename: data.filename });
        elements.fileNameDisplay.textContent = 'Hiçbir dosya seçilmedi';
        elements.fileInput.value = '';
    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        alert(`Dosya yüklenirken bir hata oluştu: ${error.message}`);
        elements.fileNameDisplay.textContent = 'Hata oluştu!';
    }
};

// Remaining functions (unchanged)
socket.on('message', (msg) => {
    if (!msg.username || !msg.message) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.id = msg.messageId;

    const content = `
        <strong>${sanitizeInput(msg.username)}</strong> (${msg.timestamp}): ${sanitizeInput(msg.message)}
        ${msg.username === username ? `<button onclick="deleteMessage('${msg.messageId}')">Sil</button>` : ''}
    `;
    messageElement.innerHTML = content;
    if (msg.username === username) messageElement.classList.add('user');

    elements.chatMessages.appendChild(messageElement);
    elements.chatMessages.scrollTo({ top: elements.chatMessages.scrollHeight, behavior: 'smooth' });
});

socket.on('send_file', (data) => {
    if (!data.username || !data.file_url) return;

    const fileElement = document.createElement('div');
    fileElement.classList.add('message');
    fileElement.id = data.filename;

    let fileContent = `<strong>${sanitizeInput(data.username)}</strong> (${data.timestamp}): `;
    if (data.username === username) {
        fileContent += `<button onclick="deleteFile('${data.filename}')">Sil</button>`;
        fileElement.classList.add('user');
    }

    if (data.file_url.match(/\.(jpeg|jpg|gif|png)$/)) {
        fileContent += `<img src="${data.file_url}" alt="Preview" style="max-width: 100%; height: auto;" onclick="openModal('${data.file_url}')"/>`;
    } else {
        const fileType = data.file_url.split('.').pop().toUpperCase();
        fileContent += `<a href="${data.file_url}" target="_blank" class="file-link"><i class="fas fa-file"></i> ${fileType} Dosyası</a>`;
    }

    fileElement.innerHTML = fileContent;
    elements.chatMessages.appendChild(fileElement);
    elements.chatMessages.scrollTo({ top: elements.chatMessages.scrollHeight, behavior: 'smooth' });
});

const deleteMessage = (messageId) => socket.emit('delete_message', { messageId });
const deleteFile = (filename) => socket.emit('delete_file', { filename });

socket.on('delete_message', (data) => {
    const messageElement = document.getElementById(data.messageId);
    if (messageElement) messageElement.remove();
});

socket.on('delete_file', (data) => {
    const fileElement = document.getElementById(data.filename);
    if (fileElement) fileElement.remove();
});

const logout = () => toggleModal(elements.cikisYapModal, true);

elements.cikisYapModalKapat.addEventListener('click', () => toggleModal(elements.cikisYapModal, false));
elements.cikisYapIptal.addEventListener('click', () => toggleModal(elements.cikisYapModal, false));
elements.cikisYapOnay.addEventListener('click', () => {
    localStorage.removeItem('username');
    window.location.href = '/';
});

const openModal = (imageUrl) => {
    toggleModal(elements.imageModal, true);
    elements.modalImage.src = imageUrl;
};

const closeModal = () => toggleModal(elements.imageModal, false);

initUsername();