(function () {
  function show(message, type = "info", duration = 3000) {
    let container = <div id="toast-container" class="toast-container"></div>
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  window.Toast = {
    success: (msg) => show(msg, "success"),
    error: (msg) => show(msg, "error"),
    warning: (msg) => show(msg, "warning"),
    info: (msg) => show(msg, "info"),
  };
})();