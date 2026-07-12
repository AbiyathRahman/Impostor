const {
    roomExists,
    getPlayers,
    hasPlayer,
    isHost,
    getPlayerCount,
    setGameData,
    submitAnswer,
    getAnswers,
    getPlayerNames,
    resetAnswers,
    checkAllPlayersAnswered,
    revealImpostor
} = require('./gameState');


function assignImpostor(players) {
    const impostorIndex = Math.floor(Math.random() * players.length);
    const impostorId = players[impostorIndex];
    console.log(`Impostor is: ${impostorId}`);
    return impostorId;
}

function assignQuestions() {

    const questions = require("../questions.json");
    const questionPairs = questions.questionPairs;
    const randomIndex = Math.floor(Math.random() * questionPairs.length);
    const selectedPair = questionPairs[randomIndex];
    console.log(`Selected question pair: ${selectedPair.normal} and ${selectedPair.imposter}`);
    return selectedPair;


}

module.exports = function gameHandler(io, socket) {
    socket.on('start-game', (roomCode) => {
        const exists = roomExists(roomCode);

        if (!exists) {
            socket.emit('message', 'Room not found');
            return;
        }

        const players = getPlayers(roomCode);
        if (!players.includes(socket.id)) {
            socket.emit('message', 'You are not in this room');
            return;
        }

        const numPlayers = getPlayerCount(roomCode);

        if (numPlayers < 3) {
            socket.emit('message', 'Not enough players to start the game');

            return;
        }
        io.to(roomCode).emit('message', 'Game started in room ' + roomCode);
        const impostorId = assignImpostor(players);
        const questionPair = assignQuestions();
        setGameData(roomCode, {
            started: true,
            impostorId,
            questionPair,
        });
        resetAnswers(roomCode);

        io.to(impostorId).emit('message', 'You are the impostor! Your question is: ' + questionPair.imposter);
        players.forEach(playerId => {
            if (playerId !== impostorId) {
                io.to(playerId).emit('message', 'You are a normal player! Your question is: ' + questionPair.normal);
            }
        });

    })

    socket.on('player-answer', (roomCode, playerIdOrAnswer, answerMaybe) => {
        const exists = roomExists(roomCode);

        if (!exists) {
            socket.emit('message', 'Room not found');
            return;
        }

        if (!hasPlayer(roomCode, socket.id)) {
            socket.emit('message', 'You are not in this room');
            return;
        }

        const answer = typeof answerMaybe === 'undefined' ? playerIdOrAnswer : answerMaybe;
        if (typeof answer === 'undefined' || answer === null || answer === '') {
            socket.emit('message', 'Answer cannot be empty');
            return;
        }

        submitAnswer(roomCode, socket.id, answer);

        if (checkAllPlayersAnswered(roomCode)) {
            const answers = getAnswers(roomCode);
            const playerNames = getPlayerNames(roomCode);
            const revealedAnswers = Object.entries(answers).map(([playerId, playerAnswer]) => ({
                playerId,
                playerName: playerNames[playerId] || 'Anonymous',
                answer: playerAnswer,
            }));
            io.to(roomCode).emit('answers-revealed', revealedAnswers);
            io.to(roomCode).emit('message', 'All answers are in. Host can now reveal the impostor.');
        }
    })

    socket.on('get-answers', (roomCode) => {
        const exists = roomExists(roomCode);

        if (!exists) {
            socket.emit('message', 'Room not found');
            return;
        }
        if (!checkAllPlayersAnswered(roomCode)) {
            socket.emit('message', 'Not all players have answered yet');
            return;
        }
        const answers = getAnswers(roomCode);
        const playerNames = getPlayerNames(roomCode);
        const revealedAnswers = Object.entries(answers).map(([playerId, playerAnswer]) => ({
            playerId,
            playerName: playerNames[playerId] || 'Anonymous',
            answer: playerAnswer,
        }));
        io.to(roomCode).emit('answers-revealed', revealedAnswers);
    })
    socket.on('reveal-impostor', (roomCode) => {
        const exists = roomExists(roomCode);

        if (!exists) {
            socket.emit('message', 'Room not found');
            return;
        }

        if (!isHost(roomCode, socket.id)) {
            socket.emit('message', 'Only the host can reveal the impostor');
            return;
        }

        if (!checkAllPlayersAnswered(roomCode)) {
            socket.emit('message', 'Cannot reveal impostor until all players answer');
            return;
        }

        const impostorId = revealImpostor(roomCode);
        if (impostorId) {
            io.to(roomCode).emit('impostor-revealed', impostorId);
        }
    })

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    })
}