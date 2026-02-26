const form = document.getElementById("register-form");
const errorEl = document.getElementById("error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  try {
    const registerResponse = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const registerPayload = await registerResponse.json();
    if (!registerResponse.ok) {
      errorEl.textContent = registerPayload.error || "Registration failed.";
      return;
    }

    const loginResponse = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const loginPayload = await loginResponse.json();
    if (!loginResponse.ok) {
      errorEl.textContent = loginPayload.error || "Registered, but login failed.";
      return;
    }

    localStorage.setItem("todo-session", JSON.stringify(loginPayload));
    window.location.href = "/todos.html";
  } catch {
    errorEl.textContent = "Unable to connect to the server.";
  }
});
