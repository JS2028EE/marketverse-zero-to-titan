// Simple sound hooks (placeholder)

const Sounds = (() => {
  function playExecute() {
    // You can later hook real audio here
    console.log("[SOUND] Order executed");
  }

  function playReject() {
    console.log("[SOUND] Order rejected");
  }

  return {
    playExecute,
    playReject
  };
})();
