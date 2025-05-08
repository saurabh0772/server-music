const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: function (req, file, cb) {
    // Use original file name or you can customize it
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Endpoint to handle file uploads
app.post('/upload', upload.single('musicFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Return the accessible URL of the uploaded file
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

let rooms = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('joinRoom', ({ roomId, isAdmin }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.isAdmin = isAdmin;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        adminId: isAdmin ? socket.id : null,
        musicState: {
          playing: false,
          currentTime: 0,
          track: null,
        },
      };
    }

    if (isAdmin) {
      rooms[roomId].adminId = socket.id;
      console.log(`Admin joined room ${roomId}`);
    } else {
      // Send current music state to new user
      const musicState = rooms[roomId].musicState;
      socket.emit('syncMusic', musicState);
    }

    io.to(roomId).emit('userJoined', { userId: socket.id, isAdmin });
  });

  socket.on('playMusic', (data) => {
    if (socket.isAdmin && socket.roomId) {
      rooms[socket.roomId].musicState = {
        playing: true,
        currentTime: data.currentTime,
        track: data.track,
      };
      socket.to(socket.roomId).emit('playMusic', data);
    }
  });

  socket.on('pauseMusic', (data) => {
    if (socket.isAdmin && socket.roomId) {
      rooms[socket.roomId].musicState.playing = false;
      rooms[socket.roomId].musicState.currentTime = data.currentTime;
      socket.to(socket.roomId).emit('pauseMusic', data);
    }
  });

  socket.on('seekMusic', (data) => {
    if (socket.isAdmin && socket.roomId) {
      rooms[socket.roomId].musicState.currentTime = data.currentTime;
      socket.to(socket.roomId).emit('seekMusic', data);
    }
  });

  socket.on('chatMessage', (msg) => {
    if (socket.roomId) {
      io.to(socket.roomId).emit('chatMessage', { userId: socket.id, message: msg });
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    if (socket.roomId) {
      io.to(socket.roomId).emit('userLeft', { userId: socket.id });
      if (socket.isAdmin && rooms[socket.roomId]) {
        // Admin left, clear adminId
        rooms[socket.roomId].adminId = null;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
