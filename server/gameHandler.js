//const questions = require("../questions.json");
//console.log(questions.questionPairs.length);
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
        const roomExists = io.sockets.adapter.rooms.has(roomCode);

        if (!roomExists) {
            socket.emit('message', 'Room not found');
            return;
        }

        let numPlayers = io.sockets.adapter.rooms.get(roomCode).size;
        assignImpostor(Array.from(io.sockets.adapter.rooms.get(roomCode)))
        assignQuestions()

        if (numPlayers > 3) {
            socket.emit('message', 'Not enough players to start the game');

            return;
        }
        io.to(roomCode).emit('message', 'Game started in room ' + roomCode);
        const impostorId = assignImpostor(Array.from(io.sockets.adapter.rooms.get(roomCode)));
        const questionPair = assignQuestions();
        io.to(impostorId).emit('message', 'You are the impostor! Your question is: ' + questionPair.imposter);
        Array.from(io.sockets.adapter.rooms.get(roomCode)).forEach(playerId => {
            if (playerId !== impostorId) {
                io.to(playerId).emit('message', 'You are a normal player! Your question is: ' + questionPair.normal);
            }
        });

    })

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    })
}