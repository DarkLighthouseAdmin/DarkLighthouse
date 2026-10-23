/* Famstamp logo: tap it from anywhere to go Home (closes menus and sheets, scrolls to the top) with a little stamp thunk. */
(function () {
  "use strict";
  var a = document.querySelector(".brand");
  if (!a) return;
  a.addEventListener("click", function (e) {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // let "open in new tab" work
    e.preventDefault();
    // close anything open on top of the page: sheets, stamp celebrations, the family menu, read-aloud
    Array.prototype.forEach.call(document.querySelectorAll(".sheetbg, .stampfx, #fammenu"), function (x) { x.remove(); });
    var chip = document.getElementById("famchip"); if (chip) chip.setAttribute("aria-expanded", "false");
    try { if (window.FS_UI && window.FS_UI.stopSpeech) window.FS_UI.stopSpeech(); } catch (err) {}
    var h = location.hash;
    if (h === "" || h === "#" || h === "#/") { if (window.MLTL_APP && window.MLTL_APP.route) window.MLTL_APP.route(); }
    else location.hash = "#/";
    window.scrollTo(0, 0);
    a.classList.remove("thunk"); void a.offsetWidth; a.classList.add("thunk");
  });
  a.addEventListener("animationend", function () { a.classList.remove("thunk"); });
})();
