const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');
const roomCode = process.argv[2];
const playerName = process.argv[3] || `Player-${Math.floor(Math.random() * 1000)}`;

socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('message', 'Hello from client!');

    socket.on('message', (msg) => {
        console.log('Message from server: ' + msg);
    })

    if (roomCode) {
        socket.emit('join-room', roomCode, playerName, (response) => {
            if (response.success) {
                console.log(`${response.playerName} joined room with code: ${response.roomCode}`);
                socket.emit('start-game', response.roomCode);
            } else {
                console.log('Could not join room: ' + response.message);
            }
        });
    } else {
        socket.emit('create-room', playerName, (response) => {
            if (response.success) {
                console.log(`${response.playerName} created room with code: ${response.roomCode}`);
                socket.emit('start-game', response.roomCode);
            }
        });
    }

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    })
})