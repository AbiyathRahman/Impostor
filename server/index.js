const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const http = require('http');
const { Server } = require('socket.io');
const handleLobbyRequest = require('./lobbyHandler');
const gameHandler = require('./gameHandler');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

io.on('connection', (socket) => {
    console.log('A user connected');

    const generateRoomCode = () => {
        let roomCode;

        do {
            roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        } while (io.sockets.adapter.rooms.has(roomCode));

        return roomCode;
    };

    socket.on('message', (msg) => {
        console.log('Message received: ' + msg);
        io.emit('message', "Random msg");
    })


    handleLobbyRequest(io, socket);
    gameHandler(io, socket);




});

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

