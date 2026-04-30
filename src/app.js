const demoButton = document.getElementById("demoButton");

if (demoButton) {
  demoButton.addEventListener("click", () => {
    alert(
      "MVP Flow: Profile setup → Garment upload → Outfit composition → Context selection → AI analysis → Buy-or-skip recommendation."
    );
  });
}

console.log("[AI Try-On MVP] Frontend placeholder loaded.");
