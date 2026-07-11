module.exports = function handleLobbyRequest(io, socket) {

    const generateRoomCode = () => {
        let roomCode;

        do {
            roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        } while (io.sockets.adapter.rooms.has(roomCode));

        return roomCode;
    };

    socket.on('create-room', (callback) => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);

        callback({ success: true, roomCode });
        const room = io.sockets.adapter.rooms.get(roomCode);
        io.to(roomCode).emit('message', `There are ${room ? room.size : 0} users in room ${roomCode}`);
    })
    socket.on('join-room', (roomCode, callback) => {
        const roomExists = io.sockets.adapter.rooms.has(roomCode);

        if (!roomExists) {
            if (callback) {
                callback({ success: false, message: 'Room not found' });
            }

            return;
        }

        socket.join(roomCode);

        if (callback) {
            callback({ success: true, roomCode });
        }

        io.to(roomCode).emit('message', `A user has joined room ${roomCode}`);
        io.to(roomCode).emit('message', `There are ${io.sockets.adapter.rooms.get(roomCode).size} users in room ${roomCode}`);

    })

    socket.on('leave-room', (roomCode, callback) => {
        const roomExists = io.sockets.adapter.rooms.has(roomCode);

        if (!roomExists) {
            if (callback) {
                callback({ success: false, message: 'Room not found' });
            }
            return;
        }

        socket.leave(roomCode);

        if (callback) {
            callback({ success: true, roomCode });
        }

        io.to(roomCode).emit('message', `A user has left room ${roomCode}`);
        const room = io.sockets.adapter.rooms.get(roomCode);

        if (!room) {
            io.emit('message', `Room ${roomCode} is now empty`);
        } else {
            io.to(roomCode).emit('message', `There are ${room.size} users in room ${roomCode}`);
        }
    })
}