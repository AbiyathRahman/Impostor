const {
    createRoom,
    roomExists,
    deleteRoom,
    addPlayer,
    removePlayer,
    getPlayerCount,
    getPlayerName,
    isHost,
} = require('./gameState');

module.exports = function handleLobbyRequest(io, socket) {

    const generateRoomCode = () => {
        let roomCode;

        do {
            roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        } while (io.sockets.adapter.rooms.has(roomCode));

        return roomCode;
    };

    socket.on('create-room', (playerNameOrCallback, callbackMaybe) => {
        const callback = typeof playerNameOrCallback === 'function' ? playerNameOrCallback : callbackMaybe;
        const playerName = typeof playerNameOrCallback === 'string' ? playerNameOrCallback.trim() : '';
        const safePlayerName = playerName || 'Anonymous';

        const roomCode = generateRoomCode();
        createRoom(roomCode);
        socket.join(roomCode);
        addPlayer(roomCode, socket.id, safePlayerName);

        if (callback) {
            callback({ success: true, roomCode, playerName: safePlayerName, isHost: isHost(roomCode, socket.id) });
        }
        io.to(roomCode).emit('message', `${safePlayerName} created room ${roomCode}`);
        io.to(roomCode).emit('message', `There are ${getPlayerCount(roomCode)} users in room ${roomCode}`);
    })
    socket.on('join-room', (roomCode, playerNameOrCallback, callbackMaybe) => {
        const callback = typeof playerNameOrCallback === 'function' ? playerNameOrCallback : callbackMaybe;
        const playerName = typeof playerNameOrCallback === 'string' ? playerNameOrCallback.trim() : '';
        const safePlayerName = playerName || 'Anonymous';
        const exists = roomExists(roomCode);

        if (!exists) {
            if (callback) {
                callback({ success: false, message: 'Room not found' });
            }

            return;
        }

        socket.join(roomCode);
        addPlayer(roomCode, socket.id, safePlayerName);

        if (callback) {
            callback({ success: true, roomCode, playerName: safePlayerName, isHost: isHost(roomCode, socket.id) });
        }

        io.to(roomCode).emit('message', `${safePlayerName} has joined room ${roomCode}`);
        io.to(roomCode).emit('message', `There are ${getPlayerCount(roomCode)} users in room ${roomCode}`);

    })

    socket.on('leave-room', (roomCode, callback) => {
        const exists = roomExists(roomCode);

        if (!exists) {
            if (callback) {
                callback({ success: false, message: 'Room not found' });
            }
            return;
        }

        const leavingPlayerName = getPlayerName(roomCode, socket.id) || 'A user';
        socket.leave(roomCode);
        removePlayer(roomCode, socket.id);

        if (callback) {
            callback({ success: true, roomCode });
        }

        io.to(roomCode).emit('message', `${leavingPlayerName} has left room ${roomCode}`);
        const playersLeft = getPlayerCount(roomCode);

        if (playersLeft === 0) {
            deleteRoom(roomCode);
            io.emit('message', `Room ${roomCode} is now empty`);
        } else {
            io.to(roomCode).emit('message', `There are ${playersLeft} users in room ${roomCode}`);
        }
    })

    socket.on('disconnecting', () => {
        socket.rooms.forEach((roomCode) => {
            if (roomCode === socket.id || !roomExists(roomCode)) {
                return;
            }

            const disconnectingPlayerName = getPlayerName(roomCode, socket.id) || 'A user';
            removePlayer(roomCode, socket.id);
            const playersLeft = getPlayerCount(roomCode);

            if (playersLeft === 0) {
                deleteRoom(roomCode);
                io.emit('message', `Room ${roomCode} is now empty`);
                return;
            }

            io.to(roomCode).emit('message', `${disconnectingPlayerName} has disconnected from room ${roomCode}`);
            io.to(roomCode).emit('message', `There are ${playersLeft} users in room ${roomCode}`);
        });
    });
}