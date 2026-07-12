const rooms = {};

function createRoom(roomCode) {
    if (rooms[roomCode]) {
        return rooms[roomCode];
    }

    rooms[roomCode] = {
        players: new Set(),
        playerNames: {},
        hostId: null,
        answers: {},
        game: {
            started: false,
            impostorId: null,
            questionPair: null,
        },
    };

    return rooms[roomCode];
}

function roomExists(roomCode) {
    return Boolean(rooms[roomCode]);
}

function deleteRoom(roomCode) {
    if (!rooms[roomCode]) {
        return false;
    }

    delete rooms[roomCode];
    return true;
}

function addPlayer(roomCode, playerId, playerName) {
    const room = createRoom(roomCode);
    room.players.add(playerId);
    room.playerNames[playerId] = playerName || 'Anonymous';
    if (!room.hostId) {
        room.hostId = playerId;
    }
}

function removePlayer(roomCode, playerId) {
    if (!rooms[roomCode]) {
        return;
    }

    rooms[roomCode].players.delete(playerId);
    delete rooms[roomCode].playerNames[playerId];
    delete rooms[roomCode].answers[playerId];

    if (rooms[roomCode].hostId === playerId) {
        const nextHost = rooms[roomCode].players.values().next().value;
        rooms[roomCode].hostId = nextHost || null;
    }
}

function getPlayers(roomCode) {
    if (!rooms[roomCode]) {
        return [];
    }

    return Array.from(rooms[roomCode].players);
}

function hasPlayer(roomCode, playerId) {
    if (!rooms[roomCode]) {
        return false;
    }

    return rooms[roomCode].players.has(playerId);
}

function getPlayerCount(roomCode) {
    if (!rooms[roomCode]) {
        return 0;
    }

    return rooms[roomCode].players.size;
}

function getPlayerName(roomCode, playerId) {
    if (!rooms[roomCode]) {
        return null;
    }

    return rooms[roomCode].playerNames[playerId] || null;
}

function getPlayerNames(roomCode) {
    if (!rooms[roomCode]) {
        return {};
    }

    return { ...rooms[roomCode].playerNames };
}

function getHostId(roomCode) {
    if (!rooms[roomCode]) {
        return null;
    }

    return rooms[roomCode].hostId;
}

function isHost(roomCode, playerId) {
    if (!rooms[roomCode]) {
        return false;
    }

    return rooms[roomCode].hostId === playerId;
}

function setGameData(roomCode, gameData) {
    const room = createRoom(roomCode);
    room.game = {
        ...room.game,
        ...gameData,
    };
}

function getGameData(roomCode) {
    if (!rooms[roomCode]) {
        return null;
    }

    return rooms[roomCode].game;
}

function submitAnswer(roomCode, playerId, answer) {
    if (!rooms[roomCode]) {
        console.log(`Room ${roomCode} does not exist`);
        return;
    }
    rooms[roomCode].answers[playerId] = answer;
}

function getAnswers(roomCode) {
    if (!rooms[roomCode]) {
        console.log(`Room ${roomCode} does not exist`);
        return;
    }
    return rooms[roomCode].answers;
}
function resetAnswers(roomCode) {
    if (!rooms[roomCode]) {
        console.log(`Room ${roomCode} does not exist`);
        return;
    }
    rooms[roomCode].answers = {};
}

function checkAllPlayersAnswered(roomCode) {
    if (!rooms[roomCode]) {
        console.log(`Room ${roomCode} does not exist`);
        return false;
    }
    const room = rooms[roomCode];
    return room.players.size === Object.keys(room.answers).length;
}

function revealImpostor(roomCode) {
    if (!rooms[roomCode]) {
        console.log(`Room ${roomCode} does not exist`);
        return null;
    }
    const impostorId = rooms[roomCode].game.impostorId;
    return impostorId;
}

module.exports = {
    createRoom,
    roomExists,
    deleteRoom,
    addPlayer,
    removePlayer,
    getPlayers,
    hasPlayer,
    getPlayerCount,
    getPlayerName,
    getPlayerNames,
    getHostId,
    isHost,
    setGameData,
    getGameData,
    submitAnswer,
    getAnswers,
    resetAnswers,
    checkAllPlayersAnswered,
    revealImpostor,
};