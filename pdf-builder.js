/*
 * pdf-builder.js — Draws circular Dobble cards on canvas, assembles PDF
 *
 * Each card is rendered on an off-screen canvas at ~300 DPI,
 * then placed 4-up on A4 portrait pages.
 */

var _CANVAS  = 1000;   // canvas pixels
var _CENTER  = 500;
var _RADIUS  = 440;    // card circle radius in canvas pixels

/* Image slot positions — offsets from card centre (px), plus bounding-box size */
var _LAYOUTS = {
  3: [
    { x:    0, y: -170, size: 250 },   // large  — top-centre
    { x: -155, y:  105, size: 195 },   // medium — bottom-left
    { x:  155, y:  105, size: 195 }    // medium — bottom-right
  ],
  4: [
    { x: -145, y: -145, size: 225 },   // large  — top-left
    { x:  145, y: -160, size: 150 },   // small  — top-right
    { x: -150, y:  140, size: 150 },   // small  — bottom-left
    { x:  145, y:  130, size: 190 }    // medium — bottom-right
  ],
  5: [
    { x:  -75, y: -240, size: 140 },   // small  — top-centre
    { x: -205, y:  -50, size: 170 },   // medium — left-middle
    { x:  115, y: -115, size: 210 },   // large  — centre-right
    { x: -175, y:  175, size: 140 },   // small  — bottom-left
    { x:  105, y:  155, size: 165 }    // medium — bottom-right
  ]
};

/* PDF placement — A4 portrait 210×297 mm, 2×2 grid */
var _DIAM_MM = 85;
var _HALF    = _DIAM_MM / 2;
var _SPOTS   = [
  { x:  52.5, y:  78  },   // top-left
  { x: 157.5, y:  78  },   // top-right
  { x:  52.5, y: 200  },   // bottom-left
  { x: 157.5, y: 200  }    // bottom-right
];

/* Pre-set rotation angles (degrees) — shuffled per card for variety */
var _ANGLES = [0, 25, 55, 90, 130, 165, 195, 230, 265, 300, 330, 350];

function _shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ── Draw one card on the provided canvas context ── */
function _drawCard(ctx, imageIndices, images, layout, debug) {
  // White background (avoids black on JPEG export)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, _CANVAS, _CANVAS);

  // Circle border
  ctx.beginPath();
  ctx.arc(_CENTER, _CENTER, _RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Clip all drawing to inside the circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(_CENTER, _CENTER, _RADIUS - 4, 0, Math.PI * 2);
  ctx.clip();

  // Shuffle order so each image lands in a different-sized slot per card
  var shuffled = _shuffle(imageIndices);
  var angles   = _shuffle(_ANGLES);

  for (var i = 0; i < shuffled.length; i++) {
    var idx  = shuffled[i];
    var img  = images[idx];
    var slot = layout[i];
    var deg  = angles[i % angles.length];

    ctx.save();
    ctx.translate(_CENTER + slot.x, _CENTER + slot.y);
    ctx.rotate(deg * Math.PI / 180);

    // Fit image maintaining aspect ratio
    var ar = img.naturalWidth / img.naturalHeight;
    var dw, dh;
    if (ar >= 1) { dw = slot.size; dh = slot.size / ar; }
    else         { dh = slot.size; dw = slot.size * ar; }

    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // Debug label (always upright, centred on the image position)
    if (debug) {
      ctx.save();
      ctx.translate(_CENTER + slot.x, _CENTER + slot.y);
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.font         = "bold 28px Arial";
      ctx.strokeStyle  = "#ffffff";
      ctx.lineWidth    = 5;
      ctx.fillStyle    = "rgba(210,30,30,0.9)";
      var lbl = "img-" + (idx + 1);
      ctx.strokeText(lbl, 0, 0);
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    }
  }

  ctx.restore(); // release clip
}

/* ── Main entry: build and return a jsPDF document ── */
async function buildPDF(cards, images, perCard, debug, onProgress) {
  var jsPDF  = window.jspdf.jsPDF;
  var doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var layout = _LAYOUTS[perCard];

  var canvas  = document.createElement("canvas");
  canvas.width  = _CANVAS;
  canvas.height = _CANVAS;
  var ctx = canvas.getContext("2d");

  for (var i = 0; i < cards.length; i++) {
    if (i > 0 && i % 4 === 0) doc.addPage();

    _drawCard(ctx, cards[i], images, layout, debug);

    var data = canvas.toDataURL("image/jpeg", 0.95);
    var pos  = _SPOTS[i % 4];
    doc.addImage(data, "JPEG", pos.x - _HALF, pos.y - _HALF, _DIAM_MM, _DIAM_MM);

    if (onProgress) onProgress((i + 1) / cards.length);
    // Yield so the browser can repaint the progress bar
    await new Promise(function (r) { setTimeout(r, 15); });
  }

  return doc;
}
