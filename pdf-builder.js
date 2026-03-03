/*
 * pdf-builder.js — Draws circular Dobble cards on canvas, assembles PDF
 *
 * Cards print at 130mm diameter, 2 per A4 page (large & easy to cut).
 */

var _CANVAS  = 1000;
var _CENTER  = 500;
var _RADIUS  = 440;
var _BORDER  = 14;     // canvas-pixel stroke width → ~1.8 mm printed

/* Image slot positions — offsets from card centre, plus size in canvas px */
var _LAYOUTS = {
  3: [
    { x:    0, y: -170, size: 280 },   // large  — top-centre
    { x: -155, y:  105, size: 220 },   // medium — bottom-left
    { x:  155, y:  105, size: 220 }    // medium — bottom-right
  ],
  4: [
    { x: -145, y: -145, size: 250 },   // large  — top-left
    { x:  145, y: -160, size: 170 },   // small  — top-right
    { x: -150, y:  140, size: 170 },   // small  — bottom-left
    { x:  145, y:  130, size: 210 }    // medium — bottom-right
  ],
  5: [
    { x: -100, y: -260, size: 150 },   // small  — top-centre
    { x: -205, y:  -50, size: 190 },   // medium — left-middle
    { x:  115, y: -115, size: 235 },   // large  — centre-right
    { x: -175, y:  175, size: 160 },   // small  — bottom-left
    { x:  105, y:  155, size: 185 }    // medium — bottom-right
  ]
};

/* PDF placement — A4 portrait, 2 cards per page, stacked vertically */
var _DIAM_MM = 130;
var _HALF    = _DIAM_MM / 2;
var _SPOTS   = [
  { x: 105, y:  77 },   // top card
  { x: 105, y: 220 }    // bottom card
];

var _ANGLES = [0, 25, 55, 90, 130, 165, 195, 230, 265, 300, 330, 350];

function _shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ── Draw one card ── */
function _drawCard(ctx, imageIndices, images, layout, debug, borderColour) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, _CANVAS, _CANVAS);

  // Thick coloured border
  ctx.beginPath();
  ctx.arc(_CENTER, _CENTER, _RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = borderColour;
  ctx.lineWidth   = _BORDER;
  ctx.stroke();

  // Clip images to inside the border
  ctx.save();
  ctx.beginPath();
  ctx.arc(_CENTER, _CENTER, _RADIUS - _BORDER / 2 - 1, 0, Math.PI * 2);
  ctx.clip();

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

    var ar = img.naturalWidth / img.naturalHeight;
    var dw, dh;
    if (ar >= 1) { dw = slot.size; dh = slot.size / ar; }
    else         { dh = slot.size; dw = slot.size * ar; }

    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

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

  ctx.restore();
}

/* ── Main entry ── */
async function buildPDF(cards, images, perCard, debug, borderColour, onProgress) {
  var jsPDF  = window.jspdf.jsPDF;
  var doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  var layout = _LAYOUTS[perCard];
  var perPage = _SPOTS.length;          // 2

  var canvas  = document.createElement("canvas");
  canvas.width  = _CANVAS;
  canvas.height = _CANVAS;
  var ctx = canvas.getContext("2d");

  for (var i = 0; i < cards.length; i++) {
    if (i > 0 && i % perPage === 0) doc.addPage();

    _drawCard(ctx, cards[i], images, layout, debug, borderColour);

    var data = canvas.toDataURL("image/jpeg", 0.95);
    var pos  = _SPOTS[i % perPage];
    doc.addImage(data, "JPEG", pos.x - _HALF, pos.y - _HALF, _DIAM_MM, _DIAM_MM);

    if (onProgress) onProgress((i + 1) / cards.length);
    await new Promise(function (r) { setTimeout(r, 15); });
  }

  return doc;
}
