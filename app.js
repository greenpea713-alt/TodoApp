import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const state = {
  user: null,
  year: 0,
  month: 0, // 0~11
  selected: "", // YYYY-MM-DD
  todos: [], // 로그인한 사람의 할 일 전체
  holidays: {}, // { 2026: { "2026-01-01": "새해" } }
};

let auth = null;
let db = null;

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function todayKey() {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function showMessage(text, isError = false) {
  const el = $("message");
  el.textContent = text;
  el.classList.toggle("error", isError);
  el.classList.remove("hidden");
}

function hideMessage() {
  $("message").classList.add("hidden");
}

const ERROR_TEXT = {
  "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않습니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/email-already-in-use": "이미 가입된 이메일입니다.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
  "auth/too-many-requests": "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
};

function errorText(err) {
  return ERROR_TEXT[err.code] || "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

function showAuth() {
  $("auth-section").classList.remove("hidden");
  $("app-section").classList.add("hidden");
  $("user-area").classList.add("hidden");
}

function enterApp() {
  $("auth-section").classList.add("hidden");
  $("app-section").classList.remove("hidden");
  $("user-area").classList.remove("hidden");
  $("user-nickname").textContent = state.user.displayName || state.user.email;
}

function switchAuthTab(name) {
  const isLogin = name === "login";
  $("tab-login").classList.toggle("active", isLogin);
  $("tab-signup").classList.toggle("active", !isLogin);
  $("login-form").classList.toggle("hidden", !isLogin);
  $("signup-form").classList.toggle("hidden", isLogin);
  hideMessage();
}

// 공휴일은 공개 API에서 가져오고, 연도별로 한 번만 받아 둡니다.
async function loadHolidays(year) {
  if (state.holidays[year]) return;
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
    if (!res.ok) throw new Error("holiday api");
    const items = await res.json();
    state.holidays[year] = Object.fromEntries(items.map((i) => [i.date, i.localName]));
  } catch (err) {
    showMessage("공휴일 정보를 가져오지 못했습니다. 할 일 기능은 그대로 사용할 수 있습니다.", true);
  }
}

// 할 일 전체를 다시 읽고 화면을 그립니다.
async function loadData() {
  if (!state.user) return;
  await loadHolidays(state.year);
  try {
    const snap = await getDocs(query(collection(db, "todos"), where("uid", "==", state.user.uid)));
    state.todos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } catch (err) {
    showMessage("할 일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", true);
  }
  renderAll();
}

function renderAll() {
  renderCalendar();
  renderDayPanel();
}

function renderCalendar() {
  $("month-title").textContent = `${state.year}년 ${state.month + 1}월`;
  const grid = $("calendar-grid");
  grid.innerHTML = "";

  WEEKDAYS.forEach((w, i) => {
    const head = document.createElement("div");
    head.className = "weekday" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
    head.textContent = w;
    grid.appendChild(head);
  });

  const holidays = state.holidays[state.year] || {};
  const counts = {};
  state.todos.forEach((t) => {
    counts[t.date] = (counts[t.date] || 0) + 1;
  });

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const lastDate = new Date(state.year, state.month + 1, 0).getDate();
  const today = todayKey();

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "day empty";
    grid.appendChild(blank);
  }

  for (let d = 1; d <= lastDate; d++) {
    const key = dateKey(state.year, state.month, d);
    const dow = (firstDay + d - 1) % 7;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    if (dow === 0) btn.classList.add("sun");
    if (dow === 6) btn.classList.add("sat");
    if (holidays[key]) btn.classList.add("holiday");
    if (key === today) btn.classList.add("today");
    if (key === state.selected) btn.classList.add("selected");

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = d;
    btn.appendChild(num);

    if (holidays[key]) {
      const name = document.createElement("span");
      name.className = "hname";
      name.textContent = holidays[key];
      btn.appendChild(name);
    }
    if (counts[key]) {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = `할 일 ${counts[key]}`;
      btn.appendChild(count);
    }

    btn.addEventListener("click", () => {
      state.selected = key;
      renderAll();
    });
    grid.appendChild(btn);
  }
}

function renderDayPanel() {
  const [y, m, d] = state.selected.split("-").map(Number);
  $("selected-date").textContent = `${y}년 ${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;

  const holiday = (state.holidays[y] || {})[state.selected];
  $("selected-holiday").textContent = holiday || "";
  $("selected-holiday").classList.toggle("hidden", !holiday);

  const list = $("todo-list");
  list.innerHTML = "";
  const items = state.todos.filter((t) => t.date === state.selected);

  items.forEach((t) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (t.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!t.done;
    checkbox.addEventListener("change", () => toggleTodo(t.id, checkbox.checked));

    const title = document.createElement("span");
    title.className = "todo-title";
    title.textContent = t.title;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-delete";
    del.textContent = "삭제";
    del.addEventListener("click", () => deleteTodo(t.id));

    li.append(checkbox, title, del);
    list.appendChild(li);
  });

  $("empty-message").classList.toggle("hidden", items.length > 0);
}

async function toggleTodo(id, done) {
  try {
    await updateDoc(doc(db, "todos", id), { done });
    hideMessage();
  } catch (err) {
    showMessage("변경하지 못했습니다. 다시 시도해 주세요.", true);
  }
  await loadData();
}

async function deleteTodo(id) {
  if (!confirm("이 할 일을 삭제할까요?")) return;
  try {
    await deleteDoc(doc(db, "todos", id));
    hideMessage();
  } catch (err) {
    showMessage("삭제하지 못했습니다. 다시 시도해 주세요.", true);
  }
  await loadData();
}

async function moveMonth(step) {
  const next = new Date(state.year, state.month + step, 1);
  state.year = next.getFullYear();
  state.month = next.getMonth();
  await loadData();
}

function bindEvents() {
  $("tab-login").addEventListener("click", () => switchAuthTab("login"));
  $("tab-signup").addEventListener("click", () => switchAuthTab("signup"));

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
      e.target.reset();
      hideMessage();
    } catch (err) {
      showMessage(errorText(err), true);
    }
  });

  $("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nickname = $("signup-nickname").value.trim();
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        $("signup-email").value.trim(),
        $("signup-password").value
      );
      await updateProfile(cred.user, { displayName: nickname });
      e.target.reset();
      hideMessage();
      enterApp();
    } catch (err) {
      showMessage(errorText(err), true);
    }
  });

  $("logout-btn").addEventListener("click", () => signOut(auth));

  $("prev-btn").addEventListener("click", () => moveMonth(-1));
  $("next-btn").addEventListener("click", () => moveMonth(1));
  $("today-btn").addEventListener("click", () => {
    const now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();
    state.selected = todayKey();
    loadData();
  });

  $("todo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("todo-input").value.trim();
    if (!title) return;
    try {
      await addDoc(collection(db, "todos"), {
        uid: state.user.uid,
        title,
        date: state.selected,
        done: false,
        createdAt: Date.now(),
      });
      $("todo-input").value = "";
      hideMessage();
    } catch (err) {
      showMessage("추가하지 못했습니다. 다시 시도해 주세요.", true);
    }
    await loadData();
  });
}

function startApp() {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  state.selected = todayKey();

  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (user) {
      enterApp();
      await loadData();
    } else {
      showAuth();
    }
  });
}

const configured = Object.values(firebaseConfig).every((v) => typeof v === "string" && v.length > 0);

if (configured) {
  startApp();
} else {
  showMessage("firebase-config.js 파일에 Firebase 설정값을 넣어 주세요.", true);
}
