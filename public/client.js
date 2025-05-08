const socket = io();

const joinRoomDiv = document.getElementById('join-room');
const appDiv = document.getElementById('app');
const roomNameSpan = document.getElementById('room-name');
const joinBtn = document.getElementById('join-btn');
const roomIdInput = document.getElementById('room-id');
const isAdminCheckbox = document.getElementById('is-admin');

const audio = document.getElementById('audio');
const fileInput = document.getElementById('file-input');
const musicSelectionDiv = document.getElementById('music-selection');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

let isAdmin = false;
let roomId = null;
let musicFileUrl = null;

joinBtn.addEventListener('click', () => {
  roomId = roomIdInput.value.trim();
  if (!roomId) {
    alert('Please enter a room ID');
    return;
  }
  isAdmin = isAdminCheckbox.checked;

  joinRoomDiv.style.display = 'none';
  appDiv.style.display = 'block';
  roomNameSpan.textContent = roomId;

  socket.emit('joinRoom', { roomId, isAdmin });

  if (isAdmin) {
    musicSelectionDiv.style.display = 'block';
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) {
    // Upload file to server
    const formData = new FormData();
    formData.append('musicFile', file);

    fetch('/upload', {
      method: 'POST',
      body: formData,
    })
      .then(response => response.json())
      .then(data => {
        if (data.fileUrl) {
          if (musicFileUrl) {
            URL.revokeObjectURL(musicFileUrl);
          }
          musicFileUrl = data.fileUrl;
          audio.src = musicFileUrl;
          audio.load();
          audio.pause();
          // Notify users about new track
          socket.emit('playMusic', { currentTime: 0, track: musicFileUrl });
        } else {
          alert('Failed to upload file');
        }
      })
      .catch(() => {
        alert('Failed to upload file');
      });
  }
});

audio.addEventListener('play', () => {
  if (isAdmin) {
    socket.emit('playMusic', { currentTime: audio.currentTime, track: musicFileUrl });
  }
});

audio.addEventListener('pause', () => {
  if (isAdmin) {
    socket.emit('pauseMusic', { currentTime: audio.currentTime });
  }
});

audio.addEventListener('seeked', () => {
  if (isAdmin) {
    socket.emit('seekMusic', { currentTime: audio.currentTime });
  }
});

socket.on('playMusic', (data) => {
  if (!isAdmin) {
    if (data.track && data.track !== musicFileUrl) {
      if (musicFileUrl) {
        URL.revokeObjectURL(musicFileUrl);
      }
      musicFileUrl = data.track;
      audio.src = musicFileUrl;
      audio.load();
    }
    audio.currentTime = data.currentTime;
    audio.play();
  }
});

socket.on('pauseMusic', (data) => {
  if (!isAdmin) {
    audio.currentTime = data.currentTime;
    audio.pause();
  }
});

socket.on('seekMusic', (data) => {
  if (!isAdmin) {
    audio.currentTime = data.currentTime;
  }
});

socket.on('syncMusic', (musicState) => {
  if (!isAdmin) {
    if (musicState.track && musicState.track !== musicFileUrl) {
      if (musicFileUrl) {
        URL.revokeObjectURL(musicFileUrl);
      }
      musicFileUrl = musicState.track;
      audio.src = musicFileUrl;
      audio.load();
    }
    audio.currentTime = musicState.currentTime || 0;
    if (musicState.playing) {
      audio.play();
    } else {
      audio.pause();
    }
  }
});

sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (message) {
    socket.emit('chatMessage', message);
    chatInput.value = '';
  }
}

socket.on('chatMessage', ({ userId, message }) => {
  const div = document.createElement('div');
  div.textContent = `${userId.substring(0, 5)}: ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('userJoined', ({ userId, isAdmin }) => {
  const div = document.createElement('div');
  div.textContent = `User ${userId.substring(0, 5)} joined${isAdmin ? ' as Admin' : ''}`;
  div.style.fontStyle = 'italic';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('userLeft', ({ userId }) => {
  const div = document.createElement('div');
  div.textContent = `User ${userId.substring(0, 5)} left`;
  div.style.fontStyle = 'italic';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
