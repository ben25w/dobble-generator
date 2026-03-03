/*
 * app.js — UI controller for Dobble Card Generator
 */
(function () {

  /* ── State ── */
  var order       = null;
  var debug       = false;
  var files       = [];
  var needed      = 0;
  var pdfDoc      = null;

  /* ── Config per order ── */
  var CFG = {
    2: { images: 7,  cards: 7,  per: 3, pages: 2, label: "Small"  },
    3: { images: 13, cards: 13, per: 4, pages: 4, label: "Medium" },
    4: { images: 21, cards: 21, per: 5, pages: 6, label: "Large"  }
  };

  /* ── DOM refs ── */
  var step1       = document.getElementById("step1");
  var step2       = document.getElementById("step2");
  var step3       = document.getElementById("step3");
  var step4       = document.getElementById("step4");
  var msg         = document.getElementById("uploadMessage");
  var dropZone    = document.getElementById("dropZone");
  var fileInput   = document.getElementById("fileInput");
  var counter     = document.getElementById("counter");
  var err         = document.getElementById("uploadError");
  var thumbs      = document.getElementById("thumbnails");
  var genBtn      = document.getElementById("generateBtn");
  var backBtn     = document.getElementById("backBtn");
  var bar         = document.getElementById("progressBar");
  var progTxt     = document.getElementById("progressText");
  var dlBtn       = document.getElementById("downloadBtn");
  var restartBtn  = document.getElementById("restartBtn");
  var summary     = document.getElementById("summaryText");
  var debugWrap   = document.getElementById("debugBtn");

  /* ─────────────────────────────────────
     Debug button visibility
     During testing: it's always visible.
     When done: uncomment these two lines
     so it only appears with ?debug=true
  ───────────────────────────────────── */
  // debugWrap.style.display = "none";
  // if (location.search.indexOf("debug=true") !== -1) debugWrap.style.display = "block";

  /* ── Helpers ── */
  function show(el)  { el.classList.remove("hidden"); }
  function hide(el)  { el.classList.add("hidden"); }

  function showStep(n) {
    hide(step1); hide(step2); hide(step3); hide(step4);
    if (n === 1) show(step1);
    if (n === 2) show(step2);
    if (n === 3) show(step3);
    if (n === 4) show(step4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Step 1 — size selection ── */
  var btns = document.querySelectorAll(".size-btn");
  for (var b = 0; b < btns.length; b++) {
    btns[b].addEventListener("click", function () {
      order  = parseInt(this.getAttribute("data-order"));
      debug  = this.getAttribute("data-debug") === "true";
      needed = CFG[order].images;

      // reset upload
      files = [];
      thumbs.innerHTML = "";
      fileInput.value   = "";
      hide(err);
      genBtn.disabled = true;

      msg.textContent = "Upload exactly " + needed + " images";
      refreshCounter();
      showStep(2);
    });
  }

  /* ── Step 2 — upload ── */
  function refreshCounter() {
    var n = files.length;
    if (n === 0) {
      counter.textContent = "No images uploaded yet";
    } else {
      counter.textContent = n + " of " + needed + " images uploaded" + (n === needed ? " ✓" : "");
    }
    genBtn.disabled = (n !== needed);

    if (n > needed) {
      err.textContent = "You've uploaded " + n + " images but only " + needed + " are needed. Please remove " + (n - needed) + ".";
      show(err);
      genBtn.disabled = true;
    } else {
      hide(err);
    }
  }

  function addFiles(list) {
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (f.type === "image/png" || f.type === "image/jpeg") {
        files.push(f);
        makeThumbnail(f, files.length - 1);
      }
    }
    refreshCounter();
  }

  function makeThumbnail(file, idx) {
    var wrap = document.createElement("div");
    wrap.className = "thumb-wrapper";
    wrap.setAttribute("data-idx", idx);

    var img = document.createElement("img");
    img.src = URL.createObjectURL(file);

    var rm = document.createElement("button");
    rm.className = "thumb-remove";
    rm.textContent = "×";
    rm.addEventListener("click", function () {
      var i = parseInt(wrap.getAttribute("data-idx"));
      files.splice(i, 1);
      rebuildThumbs();
      refreshCounter();
    });

    wrap.appendChild(img);
    wrap.appendChild(rm);
    thumbs.appendChild(wrap);
  }

  function rebuildThumbs() {
    thumbs.innerHTML = "";
    for (var i = 0; i < files.length; i++) makeThumbnail(files[i], i);
  }

  fileInput.addEventListener("change", function () {
    addFiles(this.files);
    this.value = "";
  });

  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    addFiles(e.dataTransfer.files);
  });

  backBtn.addEventListener("click", function () { showStep(1); });

  /* ── Step 3 — generate ── */
  genBtn.addEventListener("click", function () {
    showStep(3);
    bar.style.width = "0%";
    progTxt.textContent = "Loading images…";

    // Load every file as an Image object
    var promises = files.map(function (f) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (ev) {
          var img = new Image();
          img.onload  = function () { resolve(img); };
          img.onerror = function () { reject(new Error("Could not load " + f.name)); };
          img.src = ev.target.result;
        };
        reader.onerror = function () { reject(new Error("Could not read " + f.name)); };
        reader.readAsDataURL(f);
      });
    });

    Promise.all(promises)
      .then(function (images) {
        bar.style.width = "8%";
        progTxt.textContent = "Generating card combinations…";

        var cards;
        try { cards = generateCards(order); }
        catch (e) { progTxt.textContent = "Error: " + e.message; return; }

        var cfg = CFG[order];
        progTxt.textContent = "Drawing " + cfg.cards + " cards…";

        return buildPDF(cards, images, cfg.per, debug, function (p) {
          bar.style.width = (8 + Math.round(p * 88)) + "%";
          progTxt.textContent = "Drawing card " + Math.ceil(p * cfg.cards) + " of " + cfg.cards + "…";
        });
      })
      .then(function (doc) {
        if (!doc) return;            // error already shown
        pdfDoc = doc;
        bar.style.width = "100%";
        progTxt.textContent = "Done!";

        setTimeout(function () {
          var c = CFG[order];
          summary.textContent = c.cards + " cards generated (" + c.per + " images per card) — " + c.pages + " A4 pages ready to print.";
          showStep(4);
        }, 350);
      })
      .catch(function (e) {
        progTxt.textContent = "Error: " + e.message;
        console.error(e);
      });
  });

  /* ── Step 4 — download / restart ── */
  dlBtn.addEventListener("click", function () {
    if (pdfDoc) pdfDoc.save("dobble-cards-" + CFG[order].images + ".pdf");
  });

  restartBtn.addEventListener("click", function () {
    pdfDoc = null;
    order  = null;
    debug  = false;
    files  = [];
    showStep(1);
  });

})();
