import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

function shortId(value) {
    if (!value) {
        return 'Unknown';
    }

    if (value.length <= 10) {
        return value;
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

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

    const [role, setRole] = useState('');
    const [question, setQuestion] = useState('');
    const [answerText, setAnswerText] = useState('');
    const [answerSubmitted, setAnswerSubmitted] = useState(false);

    const [answers, setAnswers] = useState(null);
    const [impostorId, setImpostorId] = useState('');
    const [messages, setMessages] = useState([]);

    const canStart = inRoom && isHost && playerCount >= 3 && !question;
    const canSubmitAnswer = inRoom && question && !answerSubmitted;
    const canRevealImpostor = inRoom && isHost && Boolean(answers) && !impostorId;

    const answerEntries = useMemo(() => {
        if (!answers) {
            return [];
        }

        return Object.entries(answers);
    }, [answers]);

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

            if (msg.includes('You are the impostor!')) {
                setRole('Impostor');
                const parsedQuestion = parseQuestionMessage(msg);
                if (parsedQuestion) {
                    setQuestion(parsedQuestion);
                }
            }

            if (msg.includes('You are a normal player!')) {
                setRole('Player');
                const parsedQuestion = parseQuestionMessage(msg);
                if (parsedQuestion) {
                    setQuestion(parsedQuestion);
                }
            }
        });

        socket.on('answers-revealed', (roomAnswers) => {
            setAnswers(roomAnswers);
            setMessages((prev) => [...prev, 'Answers are now revealed']);
        });

        socket.on('impostor-revealed', (revealedImpostorId) => {
            setImpostorId(revealedImpostorId);
            setMessages((prev) => [...prev, 'Impostor has been revealed']);
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
            setRole('');
            setQuestion('');
            setAnswerText('');
            setAnswerSubmitted(false);
            setAnswers(null);
            setImpostorId('');
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
            setRole('');
            setQuestion('');
            setAnswerText('');
            setAnswerSubmitted(false);
            setAnswers(null);
            setImpostorId('');
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
            setRole('');
            setQuestion('');
            setAnswerText('');
            setAnswerSubmitted(false);
            setAnswers(null);
            setImpostorId('');
            setMessages((prev) => [...prev, 'You left the room']);
        });
    };

    return (
        <div className="app-shell">
            <div className="bg-orb orb-a" />
            <div className="bg-orb orb-b" />
            <main className="layout">
                <section className="panel panel-main">
                    <header className="hero">
                        <p className="status-dot" data-online={connected}>
                            {connected ? 'Server online' : 'Server offline'}
                        </p>
                        <h1>Impostor Party</h1>
                        <p className="subhead">A quick social deduction round powered by your Socket.IO backend.</p>
                    </header>

                    {!inRoom ? (
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
                    ) : (
                        <>
                            <article className="room-banner">
                                <div>
                                    <p className="meta-label">Room</p>
                                    <h2>{roomCode}</h2>
                                </div>
                                <div className="room-tags">
                                    <span className="tag">{playerCount} players</span>
                                    <span className="tag">{isHost ? 'Host' : 'Guest'}</span>
                                </div>
                            </article>

                            <article className="card flow-card">
                                <h2>Game Flow</h2>
                                <ol>
                                    <li>Gather at least 3 players.</li>
                                    <li>Host starts the game.</li>
                                    <li>Everyone submits one answer.</li>
                                    <li>Answers reveal to all, then host reveals impostor.</li>
                                </ol>

                                <div className="button-row">
                                    <button className="btn btn-primary" onClick={doStartGame} disabled={!canStart}>
                                        Start Game
                                    </button>
                                    <button className="btn" onClick={doLeaveRoom}>Leave Room</button>
                                </div>
                            </article>

                            {question ? (
                                <article className="card question-card">
                                    <p className="meta-label">Your Role</p>
                                    <h3>{role || 'Player'}</h3>
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
                                </article>
                            ) : (
                                <article className="card waiting-card">
                                    <h3>Waiting for game start</h3>
                                    <p>Once the host starts, your role and question will appear here.</p>
                                </article>
                            )}

                            {answers && (
                                <article className="card reveal-card">
                                    <h3>Answers Revealed</h3>
                                    <ul>
                                        {answerEntries.map(([playerId, answer]) => (
                                            <li key={playerId}>
                                                <span>{shortId(playerId)}</span>
                                                <p>{answer}</p>
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
                                    <p>{shortId(impostorId)}</p>
                                </article>
                            )}
                        </>
                    )}
                </section>

                <aside className="panel panel-log">
                    <h2>Live Feed</h2>
                    <div className="message-list">
                        {messages.length === 0 ? <p>No events yet.</p> : null}
                        {messages.map((msg, idx) => (
                            <p key={`${msg}-${idx}`}>{msg}</p>
                        ))}
                    </div>
                </aside>
            </main>
        </div>
    );
}
