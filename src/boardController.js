import { Chess } from "chess.js";

const LAST_MOVE = { class: "last-move", slice: "markerSquare" };
const CHECK_MARKER = { class: "king-check", slice: "markerSquare" };
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function createBoardController({
  elements,
  getBoard,
  getChess,
  inputHandler,
  onDiffLeds,
}) {
  const { scoreEl, frameEl } = elements;

  function board() {
    return getBoard();
  }

  function chess() {
    return getChess();
  }

  function updateScore() {
    const score = chess().board().flat().reduce((total, piece) => {
      if (!piece) return total;
      const value = PIECE_VALUES[piece.type] || 0;
      return total + (piece.color === "w" ? value : -value);
    }, 0);
    scoreEl.textContent = score === 0 ? "+0" : score > 0 ? `+${score}` : String(score);
    scoreEl.className = score > 0 ? "ahead" : score < 0 ? "behind" : "";
  }

  function placement(fen = chess().fen()) {
    return fen.split(" ")[0];
  }

  function legalMoveForPlacement(targetPlacement) {
    for (const move of chess().moves({ verbose: true })) {
      const probe = new Chess(chess().fen());
      const moveInput = {
        from: move.from,
        to: move.to,
      };
      if (move.promotion) moveInput.promotion = move.promotion;
      probe.move(moveInput);
      if (placement(probe.fen()) === targetPlacement) return move;
    }
    return null;
  }

  function clearLastMove() {
    board()?.removeMarkers(LAST_MOVE);
  }

  function clearCheckMarker() {
    board()?.removeMarkers(CHECK_MARKER);
  }

  function findKingSquare(color) {
    const position = chess().board();
    for (let rankIndex = 0; rankIndex < position.length; rankIndex += 1) {
      for (let fileIndex = 0; fileIndex < position[rankIndex].length; fileIndex += 1) {
        const piece = position[rankIndex][fileIndex];
        if (piece?.type === "k" && piece.color === color) {
          return `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
        }
      }
    }
    return null;
  }

  function isCurrentSideInCheck() {
    if (typeof chess().isCheck === "function") return chess().isCheck();
    if (typeof chess().inCheck === "function") return chess().inCheck();
    return false;
  }

  function updateCheckMarker() {
    clearCheckMarker();
    if (!isCurrentSideInCheck()) return;
    const kingSquare = findKingSquare(chess().turn());
    if (kingSquare) board().addMarker(CHECK_MARKER, kingSquare);
  }

  function markLastMove(from, to) {
    clearLastMove();
    board().addMarker(LAST_MOVE, from);
    board().addMarker(LAST_MOVE, to);
    updateCheckMarker();
    onDiffLeds();
  }

  function syncAfterMove(move) {
    board().setPosition(chess().fen(), true);
    markLastMove(move.from, move.to);
    updateScore();
  }

  function enableMoveInput() {
    board().disableMoveInput();
    board().enableMoveInput(inputHandler);
    frameEl.classList.remove("not-your-turn");
  }

  function disableMoveInput() {
    board()?.disableMoveInput();
    frameEl.classList.add("not-your-turn");
  }

  function moveInputFromUci(uci) {
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q",
    };
  }

  function commitBotMove(uci) {
    const move = chess().move(moveInputFromUci(uci));
    if (!move) return null;
    syncAfterMove(move);
    return move;
  }

  function applyRemoteFen(fen) {
    const incomingMove = legalMoveForPlacement(placement(fen));
    chess().load(fen);
    board().setPosition(fen, true);
    if (incomingMove) markLastMove(incomingMove.from, incomingMove.to);
    else {
      updateCheckMarker();
      onDiffLeds();
    }
    updateScore();
  }

  return {
    applyRemoteFen,
    clearCheckMarker,
    clearLastMove,
    commitBotMove,
    disableMoveInput,
    enableMoveInput,
    findKingSquare,
    isCurrentSideInCheck,
    markLastMove,
    syncAfterMove,
    updateCheckMarker,
    updateScore,
  };
}
