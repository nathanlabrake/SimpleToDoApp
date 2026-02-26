const STORAGE_KEY = "simple-todo-state-v1";
const MAX_ITEMS = 100;

const loginView = document.getElementById("login-view");
const homeView = document.getElementById("home-view");
const loginForm = document.getElementById("login-form");
const newListForm = document.getElementById("new-list-form");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");
const listError = document.getElementById("list-error");
const welcomeText = document.getElementById("welcome");
const listsContainer = document.getElementById("lists-container");
const listTemplate = document.getElementById("todo-list-template");

let state = loadState();
render();

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    loginError.textContent = "Please enter both email and password.";
    return;
  }

  state.user = { email, password };
  state.listsByUser[email] ||= [];
  loginError.textContent = "";
  loginForm.reset();
  saveState();
  render();
});

newListForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.user) {
    return;
  }

  const formData = new FormData(newListForm);
  const title = String(formData.get("listName") || "").trim();

  if (!title) {
    listError.textContent = "List name is required.";
    return;
  }

  const userLists = getCurrentUserLists();
  userLists.push({
    id: crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
    items: [],
  });

  listError.textContent = "";
  newListForm.reset();
  saveState();
  renderLists();
});

logoutBtn.addEventListener("click", () => {
  state.user = null;
  saveState();
  render();
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return {
      user: parsed?.user || null,
      listsByUser: parsed?.listsByUser || {},
    };
  } catch {
    return { user: null, listsByUser: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentUserLists() {
  if (!state.user) {
    return [];
  }

  state.listsByUser[state.user.email] ||= [];
  return state.listsByUser[state.user.email];
}

function render() {
  const loggedIn = Boolean(state.user);
  loginView.classList.toggle("active", !loggedIn);
  homeView.classList.toggle("active", loggedIn);

  if (loggedIn) {
    welcomeText.textContent = `Signed in as ${state.user.email}`;
    listError.textContent = "";
    renderLists();
  }
}

function renderLists() {
  if (!state.user) {
    return;
  }

  const sortedLists = [...getCurrentUserLists()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  listsContainer.innerHTML = "";

  if (sortedLists.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "subtext";
    emptyState.textContent = "You do not have any lists yet. Create your first one above.";
    listsContainer.appendChild(emptyState);
    return;
  }

  for (const list of sortedLists) {
    const fragment = listTemplate.content.cloneNode(true);
    const listElement = fragment.querySelector(".todo-list");
    const titleElement = fragment.querySelector(".list-title");
    const metaElement = fragment.querySelector(".meta");
    const itemsElement = fragment.querySelector(".items");
    const itemForm = fragment.querySelector(".item-form");
    const itemInput = fragment.querySelector(".item-input");
    const noteElement = fragment.querySelector(".item-note");

    titleElement.textContent = list.title;
    metaElement.textContent = `Created ${new Date(list.createdAt).toLocaleString()}`;

    for (const item of list.items) {
      const li = document.createElement("li");
      li.textContent = item;
      itemsElement.appendChild(li);
    }

    noteElement.textContent = `${list.items.length}/${MAX_ITEMS} items`;

    itemForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = itemInput.value.trim();

      if (!value) {
        return;
      }

      if (list.items.length >= MAX_ITEMS) {
        noteElement.textContent = `Item limit reached (${MAX_ITEMS}/${MAX_ITEMS})`;
        return;
      }

      list.items.push(value);
      saveState();
      renderLists();
    });

    listElement.dataset.listId = list.id;
    listsContainer.appendChild(fragment);
  }
}
