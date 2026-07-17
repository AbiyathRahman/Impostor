import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

function parseQuestionMessage(message) {
    const prefix = 'Your question is:';
    const idx = message.indexOf(prefix);
    if (idx === -1) {
        return null;
    }

    return message.slice(idx + prefix.length).trim();
}

export default function App() {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [joinCode, setJoinCode] = useState('');

    const [inRoom, setInRoom] = useState(false);
    const [roomCode, setRoomCode] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [playerCount, setPlayerCount] = useState(1);
    const [gameStarted, setGameStarted] = useState(false);

    const [role, setRole] = useState('');
    const [question, setQuestion] = useState('');
    const [generalQuestion, setGeneralQuestion] = useState('');
    const [answerText, setAnswerText] = useState('');
    const [answerSubmitted, setAnswerSubmitted] = useState(false);

    const [answers, setAnswers] = useState([]);
    const [playerNameById, setPlayerNameById] = useState({});
    const [impostorId, setImpostorId] = useState('');
    const [messages, setMessages] = useState([]);
    const [showHostActivity, setShowHostActivity] = useState(false);

    const canStart = inRoom && isHost && playerCount >= 3 && !gameStarted;
    const canSubmitAnswer = inRoom && question && !answerSubmitted;
    const canRevealImpostor = inRoom && isHost && answers.length > 0 && !impostorId;
    const canStartNewGame = inRoom && isHost && impostorId;

    const answerEntries = useMemo(() => {
        if (!answers.length) {
            return [];
        }

        return answers;
    }, [answers]);

    const revealedImpostorName = useMemo(() => {
        if (!impostorId) {
            return '';
        }

        return playerNameById[impostorId] || 'Unknown player';
    }, [impostorId, playerNameById]);

    const joinMessages = useMemo(() => {
        return messages.filter((msg) => /has joined room/i.test(msg));
    }, [messages]);

    const resetRoundState = () => {
        setGameStarted(false);
        setRole('');
        setQuestion('');
        setGeneralQuestion('');
        setAnswerText('');
        setAnswerSubmitted(false);
        setAnswers([]);
        setPlayerNameById({});
        setImpostorId('');
    };

    useEffect(() => {
        const socket = io(SERVER_URL);
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setMessages((prev) => [...prev, 'Connected to game server']);
        });

        socket.on('disconnect', () => {
            setConnected(false);
            setMessages((prev) => [...prev, 'Disconnected from game server']);
        });

        socket.on('message', (msg) => {
            setMessages((prev) => [...prev, msg]);

            const playersMatch = msg.match(/There are\s+(\d+)\s+users\s+in\s+room/i);
            if (playersMatch) {
                setPlayerCount(Number(playersMatch[1]));
            }

            if (msg.includes('Game started in room')) {
                setGameStarted(true);
            }

            if (msg.includes('You are the impostor!')) {
                setGameStarted(true);
                setRole('Impostor');
                const parsedQuestion = parseQuestionMessage(msg);
                if (parsedQuestion) {
                    setQuestion(parsedQuestion);
                }
            }

            if (msg.includes('You are a normal player!')) {
                setGameStarted(true);
                setRole('Player');
                const parsedQuestion = parseQuestionMessage(msg);
                if (parsedQuestion) {
                    setQuestion(parsedQuestion);
                }
            }
        });

        socket.on('answers-revealed', (roomAnswers) => {
            const normalizedAnswers = Array.isArray(roomAnswers)
                ? roomAnswers
                : Object.entries(roomAnswers || {}).map(([playerId, answer]) => ({
                    playerId,
                    playerName: playerNameById[playerId] || 'Anonymous',
                    answer,
                }));

            const nextNames = {};
            normalizedAnswers.forEach((entry) => {
                nextNames[entry.playerId] = entry.playerName;
            });

            setPlayerNameById((prev) => ({ ...prev, ...nextNames }));
            setAnswers(normalizedAnswers);
            setMessages((prev) => [...prev, 'Answers are now revealed']);
        });

        socket.on('impostor-revealed', (revealedImpostorId) => {
            setImpostorId(revealedImpostorId);
            setMessages((prev) => [...prev, 'Impostor has been revealed']);
        });

        socket.on('general-question', (question) => {
            setGeneralQuestion(question);
            setMessages((prev) => [...prev, `General question revealed: ${question}`]);
        });

        socket.on('game-reset', () => {
            resetRoundState();
            setMessages((prev) => [...prev, 'New game started']);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const emitWithCallback = (eventName, args, onDone) => {
        const socket = socketRef.current;
        if (!socket) {
            return;
        }

        socket.emit(eventName, ...args, (response) => {
            onDone(response);
        });
    };

    const doCreateRoom = () => {
        const name = displayName.trim();
        if (!name) {
            setMessages((prev) => [...prev, 'Enter your name before creating a room']);
            return;
        }

        emitWithCallback('create-room', [name], (response) => {
            if (!response?.success) {
                setMessages((prev) => [...prev, response?.message || 'Failed to create room']);
                return;
            }

            setInRoom(true);
            setRoomCode(response.roomCode);
            setIsHost(Boolean(response.isHost));
            setPlayerCount(1);
            setShowHostActivity(false);
            resetRoundState();
            setMessages((prev) => [...prev, `Room ${response.roomCode} created`]);
        });
    };

    const doJoinRoom = () => {
        const name = displayName.trim();
        const code = joinCode.trim();

        if (!name) {
            setMessages((prev) => [...prev, 'Enter your name before joining']);
            return;
        }

        if (!code) {
            setMessages((prev) => [...prev, 'Enter a room code']);
            return;
        }

        emitWithCallback('join-room', [code, name], (response) => {
            if (!response?.success) {
                setMessages((prev) => [...prev, response?.message || 'Failed to join room']);
                return;
            }

            setInRoom(true);
            setRoomCode(response.roomCode);
            setIsHost(Boolean(response.isHost));
            setShowHostActivity(false);
            resetRoundState();
            setMessages((prev) => [...prev, `Joined room ${response.roomCode}`]);
        });
    };

    const doStartGame = () => {
        const socket = socketRef.current;
        if (!socket || !roomCode) {
            return;
        }

        socket.emit('start-game', roomCode);
        setMessages((prev) => [...prev, 'Start game requested']);
    };

    const doSubmitAnswer = (event) => {
        event.preventDefault();

        const answer = answerText.trim();
        if (!answer) {
            return;
        }

        const socket = socketRef.current;
        if (!socket || !roomCode) {
            return;
        }

        socket.emit('player-answer', roomCode, answer);
        setAnswerSubmitted(true);
        setMessages((prev) => [...prev, 'Answer submitted']);
    };

    const doRevealImpostor = () => {
        const socket = socketRef.current;
        if (!socket || !roomCode) {
            return;
        }

        socket.emit('reveal-impostor', roomCode);
        setMessages((prev) => [...prev, 'Reveal impostor requested']);
    };

    const doNewGame = () => {
        const socket = socketRef.current;
        if (!socket || !roomCode) {
            console.log('Cannot start new game - socket:', !!socket, 'roomCode:', roomCode);
            return;
        }

        console.log('Emitting new-game event for room:', roomCode);
        socket.emit('new-game', roomCode);
        setMessages((prev) => [...prev, 'New game requested']);
    };

    const doLeaveRoom = () => {
        const socket = socketRef.current;
        if (!socket || !roomCode) {
            return;
        }

        emitWithCallback('leave-room', [roomCode], () => {
            setInRoom(false);
            setRoomCode('');
            setIsHost(false);
            setPlayerCount(1);
            setShowHostActivity(false);
            resetRoundState();
            setMessages((prev) => [...prev, 'You left the room']);
        });
    };

    return (
        <div className="app-shell">
            <div className="bg-orb orb-a" />
            <div className="bg-orb orb-b" />
            <main className={`layout ${!inRoom ? 'layout-lobby' : ''}`}>
                <section className="panel panel-main">
                    <header className="hero">
                        <h1>Impostor Party</h1>
                        <p className="subhead">Let's see if you can spot the impostor!</p>
                    </header>

                    {!inRoom ? (
                        <div className="lobby-screen">
                            <div className="card-grid">
                                <article className="card">
                                    <h2>Ready to play?</h2>
                                    <label>
                                        Display Name
                                        <input
                                            type="text"
                                            placeholder="Type your name"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                        />
                                    </label>
                                    <div className="button-row">
                                        <button className="btn btn-primary" onClick={doCreateRoom}>Create Room</button>
                                    </div>
                                </article>

                                <article className="card">
                                    <h2>Join Existing Room</h2>
                                    <label>
                                        Room Code
                                        <input
                                            type="text"
                                            placeholder="1234"
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value)}
                                            maxLength={6}
                                        />
                                    </label>
                                    <div className="button-row">
                                        <button className="btn" onClick={doJoinRoom}>Join Room</button>
                                    </div>
                                </article>
                            </div>
                        </div>
                    ) : (
                        <>
                            <article className="room-banner">
                                <div>
                                    <p className="meta-label">Room</p>
                                    <h2>{roomCode}</h2>
                                    <p className="room-meta">
                                        {playerCount} players · {isHost ? 'Host' : 'Guest'}
                                    </p>
                                </div>
                            </article>

                            {!gameStarted && (
                                <article className="card flow-card">
                                    <h2>Ready for a round?</h2>
                                    <ol>
                                        <li>Host starts a round.</li>
                                        <li>Everyone gets a role and a private question.</li>
                                        <li>Players submit one answer.</li>
                                        <li>Once all answers are in, the host reveals the impostor.</li>
                                    </ol>

                                    <div className="button-row">
                                        <button className="btn btn-primary" onClick={doStartGame} disabled={!canStart}>
                                            Start Game
                                        </button>
                                        <button className="btn" onClick={doLeaveRoom}>Leave Room</button>
                                    </div>
                                </article>
                            )}

                            {gameStarted && (
                                <article className="card question-card">
                                    <p className="meta-label">Your Role</p>
                                    <h3 className={role === 'Impostor' ? 'role-label role-label-impostor' : 'role-label'}>
                                        {role || 'Player'}
                                    </h3>

                                    {question ? (
                                        <>
                                            <p className="question-text">{question}</p>

                                            <form className="answer-form" onSubmit={doSubmitAnswer}>
                                                <textarea
                                                    value={answerText}
                                                    onChange={(e) => setAnswerText(e.target.value)}
                                                    placeholder="Enter your answer"
                                                    rows={3}
                                                    disabled={!canSubmitAnswer}
                                                />
                                                <button className="btn btn-primary" type="submit" disabled={!canSubmitAnswer}>
                                                    {answerSubmitted ? 'Submitted' : 'Submit Answer'}
                                                </button>
                                            </form>
                                        </>
                                    ) : (
                                        <p className="stage-note">Waiting for the host to assign your role and question.</p>
                                    )}
                                </article>
                            )}

                            {generalQuestion && (
                                <article className="card general-question-card">
                                    <p className="meta-label">General Question</p>
                                    <p className="question-text">{generalQuestion}</p>
                                </article>
                            )}

                            {answers.length > 0 && (
                                <article className="card reveal-card">
                                    <h3>Answers Revealed</h3>
                                    <ul>
                                        {answerEntries.map((entry) => (
                                            <li key={entry.playerId}>
                                                <span>{entry.playerName}</span>
                                                <p>{entry.answer}</p>
                                            </li>
                                        ))}
                                    </ul>
                                    {canRevealImpostor && (
                                        <button className="btn btn-danger" onClick={doRevealImpostor}>
                                            Reveal Impostor
                                        </button>
                                    )}
                                </article>
                            )}



                            {impostorId && (
                                <article className="card impostor-card">
                                    <h3>Impostor Revealed</h3>
                                    <p>{revealedImpostorName}</p>
                                    {canStartNewGame && (
                                        <button className="btn btn-primary" onClick={doNewGame}>
                                            Start New Game
                                        </button>
                                    )}
                                </article>
                            )}
                        </>
                    )}
                </section>

                {inRoom && isHost && (
                    <aside className="panel panel-log panel-log-collapsible">
                        <div className="panel-log-header">
                            <div>
                                <h2>Host Activity</h2>
                                <p className="panel-log-subtitle">Joins, answers, and impostor reveal.</p>
                            </div>
                            <button
                                className="btn panel-toggle"
                                onClick={() => setShowHostActivity((prev) => !prev)}
                                aria-expanded={showHostActivity}
                            >
                                {showHostActivity ? 'Hide' : 'Show'}
                            </button>
                        </div>

                        {showHostActivity && (
                            <div className="message-list">
                                {joinMessages.length === 0 && answers.length === 0 && !impostorId ? (
                                    <p>No host updates yet.</p>
                                ) : null}

                                {joinMessages.map((msg, idx) => (
                                    <p key={`${msg}-${idx}`}>{msg}</p>
                                ))}

                                {answers.length > 0 && (
                                    <div className="activity-group">
                                        <p className="activity-group-title">Answers submitted</p>
                                        <ul>
                                            {answerEntries.map((entry) => (
                                                <li key={entry.playerId}>
                                                    <span>{entry.playerName}</span>
                                                    <p>{entry.answer}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {impostorId && (
                                    <p className="activity-emphasis">Impostor revealed: {revealedImpostorName}</p>
                                )}
                            </div>
                        )}
                    </aside>
                )}
            </main>
        </div>
    );
}
