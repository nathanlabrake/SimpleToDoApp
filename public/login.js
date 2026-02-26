const form = document.getElementById("login-form");
const errorEl = document.getElementById("error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();
    if (!response.ok) {
      errorEl.textContent = payload.error || "Login failed.";
      return;
    }

    localStorage.setItem("todo-session", JSON.stringify(payload));
    window.location.href = "/todos.html";
  } catch {
    errorEl.textContent = "Unable to connect to the server.";
  }
});
