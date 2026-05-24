export const CHESSNUT_SERVICE_UUIDS = [
  "1b7e8261-2877-41c3-b46e-cf057c562023",
  "1b7e8271-2877-41c3-b46e-cf057c562023",
  "1b7e8281-2877-41c3-b46e-cf057c562023",
];

export const CHESSNUT_CHARACTERISTICS = {
  readBoardData: "1b7e8262-2877-41c3-b46e-cf057c562023",
  write: "1b7e8272-2877-41c3-b46e-cf057c562023",
  readMiscData: "1b7e8273-2877-41c3-b46e-cf057c562023",
};

export const CHESSNUT_DEVICE_FILTERS = [
  { namePrefix: "Chessnut Air" },
  { namePrefix: "Smart Chess" },
];

export const CHESSNUT_INIT_COMMAND = Uint8Array.from([0x21, 0x01, 0x00]);

const CHESSNUT_LED_PREFIX = Uint8Array.from([0x0A, 0x08]);

const CHESSNUT_PIECES = {
  0: "",
  1: "q",
  2: "k",
  3: "b",
  4: "p",
  5: "n",
  6: "R",
  7: "P",
  8: "r",
  9: "B",
  10: "N",
  11: "Q",
  12: "K",
};

export function chessnutBytes(value) {
  if (value instanceof DataView)
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value || []);
}

export function bytesToHex(bytes) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, "0")).join(" ");
}

export function compressFenRow(row) {
  let out = "";
  let empty = 0;
  for (const piece of row) {
    if (piece) {
      if (empty) out += String(empty);
      out += piece;
      empty = 0;
    } else {
      empty += 1;
    }
  }
  return out + (empty ? String(empty) : "");
}

export function chessnutBoardDataToPlacement(value) {
  const bytes = chessnutBytes(value);
  if (bytes.length < 32) return "";
  const offset = bytes.length >= 34 && bytes[0] === 0x01 && bytes[1] === 0x24 ? 2 : 0;
  if (bytes.length - offset < 32) return "";

  const squares = Array(64).fill("");
  for (let i = 0; i < 32; i += 1) {
    const pair = bytes[offset + i];
    const left = CHESSNUT_PIECES[pair & 0x0f];
    const right = CHESSNUT_PIECES[pair >> 4];
    if (left === undefined || right === undefined) return "";
    squares[63 - i * 2] = left;
    squares[63 - (i * 2 + 1)] = right;
  }

  const rows = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    const row = [];
    for (let file = 0; file < 8; file += 1) row.push(squares[rank * 8 + file]);
    rows.push(compressFenRow(row));
  }
  return rows.join("/");
}

export function expandPlacement(placement) {
  return placement.split("/").flatMap(row => [...row.replace(/\d/g, digit => "1".repeat(Number(digit)))]);
}

export function rotatePlacement(placement) {
  const squares = expandPlacement(placement);
  const rotated = Array(64).fill("1");
  for (let index = 0; index < 64; index += 1) {
    const rank = Math.floor(index / 8);
    const file = index % 8;
    rotated[(7 - rank) * 8 + (7 - file)] = squares[index];
  }
  const rows = [];
  for (let rank = 0; rank < 8; rank += 1)
    rows.push(compressFenRow(rotated.slice(rank * 8, rank * 8 + 8).map(piece => piece === "1" ? "" : piece)));
  return rows.join("/");
}

export function placementDiffSquares(leftPlacement, rightPlacement) {
  const left = expandPlacement(leftPlacement);
  const right = expandPlacement(rightPlacement);
  const files = "abcdefgh";
  const squares = [];
  for (let index = 0; index < 64; index += 1) {
    if (left[index] === right[index]) continue;
    squares.push(files[index % 8] + String(8 - Math.floor(index / 8)));
  }
  return squares;
}

export function bestPhysicalPlacement(placement, gamePlacement) {
  const normalDiffs = placementDiffSquares(placement, gamePlacement);
  const rotated = rotatePlacement(placement);
  const rotatedDiffs = placementDiffSquares(rotated, gamePlacement);
  if (rotatedDiffs.length < normalDiffs.length) {
    return { placement: rotated, orientation: "rotated", diffs: rotatedDiffs };
  }
  return { placement, orientation: "normal", diffs: normalDiffs };
}

export function squareToPlacementIndex(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return (8 - rank) * 8 + file;
}

export function pieceForMove(move) {
  const colorWhite = move.color === "w";
  const type = move.promotion || move.piece;
  return colorWhite ? type.toUpperCase() : type;
}

export function legalMoveFromPlacementDelta(legalMoves, previousPlacement, nextPlacement) {
  if (!previousPlacement || !nextPlacement) return null;
  const previous = expandPlacement(previousPlacement);
  const next = expandPlacement(nextPlacement);
  const changed = new Set();
  for (let index = 0; index < 64; index += 1) {
    if (previous[index] !== next[index]) changed.add(index);
  }
  if (changed.size < 2 || changed.size > 4) return null;

  for (const move of legalMoves) {
    const fromIndex = squareToPlacementIndex(move.from);
    const toIndex = squareToPlacementIndex(move.to);
    const movingPiece = pieceForMove(move);
    const fromCleared = next[fromIndex] === "1";
    const landed = next[toIndex] === movingPiece;
    if (!fromCleared || !landed || !changed.has(fromIndex) || !changed.has(toIndex)) continue;

    if (move.flags.includes("k") || move.flags.includes("q")) return move;
    if (changed.size === 2) return move;
    if (move.captured && changed.size === 2) return move;
  }

  return null;
}

export function chessnutLedBytes(squares) {
  const files = { a: 128, b: 64, c: 32, d: 16, e: 8, f: 4, g: 2, h: 1 };
  const rows = new Uint8Array(8);
  for (const square of squares || []) {
    if (!/^[a-h][1-8]$/.test(square)) continue;
    rows[8 - Number(square[1])] |= files[square[0]];
  }
  const bytes = new Uint8Array(CHESSNUT_LED_PREFIX.length + rows.length);
  bytes.set(CHESSNUT_LED_PREFIX);
  bytes.set(rows, CHESSNUT_LED_PREFIX.length);
  return bytes;
}
