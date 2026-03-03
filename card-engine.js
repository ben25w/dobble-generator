/*
 * card-engine.js — Projective plane card generator for Dobble
 *
 * For order n:
 *   n² + n + 1 images needed
 *   n² + n + 1 cards generated
 *   Each card has n + 1 images
 *   Every pair of cards shares exactly 1 image
 *
 * Supported: n=2 (7/3), n=3 (13/4), n=4 (21/5)
 */

function generateCards(order) {
  var cards;

  if (order === 2 || order === 3) {
    cards = _primeOrder(order);
  } else if (order === 4) {
    cards = _gf4Order();
  } else {
    throw new Error("Unsupported order: " + order);
  }

  if (!verifyCards(cards)) {
    throw new Error("Card verification failed — the algorithm produced invalid cards");
  }

  return cards;
}

/* ── Prime-order construction (n = 2 or 3) ── */
function _primeOrder(n) {
  var cards = [];
  var m, b, x, y, c;

  // Lines: y = mx + b (mod n)
  for (m = 0; m < n; m++) {
    for (b = 0; b < n; b++) {
      var card = [];
      for (x = 0; x < n; x++) {
        y = (m * x + b) % n;
        card.push(x * n + y);
      }
      card.push(n * n + m);
      cards.push(card);
    }
  }

  // Vertical lines: x = c
  for (c = 0; c < n; c++) {
    var vc = [];
    for (y = 0; y < n; y++) {
      vc.push(c * n + y);
    }
    vc.push(n * n + n);
    cards.push(vc);
  }

  // Line at infinity
  var inf = [];
  for (m = 0; m < n; m++) {
    inf.push(n * n + m);
  }
  inf.push(n * n + n);
  cards.push(inf);

  return cards;
}

/* ── GF(4) construction (order 4, prime-power 2²) ── */
function _gf4Order() {
  var n = 4;

  // GF(4) = {0, 1, α, α+1}  with α² + α + 1 = 0 over GF(2)
  // Represented as: 0→0, 1→1, α→2, α+1→3

  var add = [
    [0, 1, 2, 3],
    [1, 0, 3, 2],
    [2, 3, 0, 1],
    [3, 2, 1, 0]
  ];

  var mul = [
    [0, 0, 0, 0],
    [0, 1, 2, 3],
    [0, 2, 3, 1],
    [0, 3, 1, 2]
  ];

  var cards = [];
  var m, b, x, y, c;

  for (m = 0; m < n; m++) {
    for (b = 0; b < n; b++) {
      var card = [];
      for (x = 0; x < n; x++) {
        y = add[mul[m][x]][b];
        card.push(x * n + y);
      }
      card.push(n * n + m);
      cards.push(card);
    }
  }

  for (c = 0; c < n; c++) {
    var vc = [];
    for (y = 0; y < n; y++) {
      vc.push(c * n + y);
    }
    vc.push(n * n + n);
    cards.push(vc);
  }

  var inf = [];
  for (m = 0; m < n; m++) {
    inf.push(n * n + m);
  }
  inf.push(n * n + n);
  cards.push(inf);

  return cards;
}

/* ── Verification: every pair of cards must share exactly 1 image ── */
function verifyCards(cards) {
  var i, j, k;
  for (i = 0; i < cards.length; i++) {
    for (j = i + 1; j < cards.length; j++) {
      var shared = 0;
      for (k = 0; k < cards[i].length; k++) {
        if (cards[j].indexOf(cards[i][k]) !== -1) shared++;
      }
      if (shared !== 1) {
        console.error("Cards " + i + " and " + j + " share " + shared + " images (expected 1)");
        return false;
      }
    }
  }
  console.log("✓ All " + cards.length + " card pairs share exactly 1 image");
  return true;
}
