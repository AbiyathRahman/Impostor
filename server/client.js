const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');
const roomCode = process.argv[2];

socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('message', 'Hello from client!');

    socket.on('message', (msg) => {
        console.log('Message from server: ' + msg);
    })

    if (roomCode) {
        socket.emit('join-room', roomCode, (response) => {
            if (response.success) {
                console.log('Joined room with code: ' + response.roomCode);
                socket.emit('start-game', response.roomCode);
            } else {
                console.log('Could not join room: ' + response.message);
            }
        });
    } else {
        socket.emit('create-room', (response) => {
            if (response.success) {
                console.log('Room created with code: ' + response.roomCode);
                socket.emit('start-game', response.roomCode);
            }
        });
    }

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    })
})