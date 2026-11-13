// 카테고리 라벨 맵
const CATEGORY_NAMES = {
  work: '업무',
  personal: '개인',
  study: '공부'
};

// DOM 요소
const todoForm = document.getElementById('todoForm');
const todoInput = document.getElementById('todoInput');
const categorySelect = document.getElementById('categorySelect');
const todoList = document.getElementById('todoList');
const emptyMessage = document.getElementById('emptyMessage');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const searchInput = document.getElementById('searchInput');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const filterGroup = document.getElementById('filterGroup');

// 애플리케이션 상태
let currentFilter = 'all';
let searchQuery = '';
let editingId = null;

// localStorage에서 데이터 로드 (기존 데이터 category 없을 시 'personal' 기본값 처리)
function loadTodos() {
  const saved = localStorage.getItem('todos');
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => ({
      id: item.id || Date.now() + Math.random(),
      text: item.text || '',
      completed: Boolean(item.completed),
      category: item.category || 'personal'
    }));
  } catch (e) {
    console.error('Failed to parse todos from localStorage', e);
    return [];
  }
}

let todos = loadTodos();

// localStorage에 저장
function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

// 진행률 계산 및 업데이트
function updateProgress() {
  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressText.textContent = `${completed}/${total} 완료 (${percentage}%)`;
  progressBar.style.width = `${percentage}%`;
}

// 화면 렌더링
function render() {
  // 필터링 (카테고리 + 실시간 검색)
  const filtered = todos.filter(todo => {
    const matchesCategory = currentFilter === 'all' || todo.category === currentFilter;
    const matchesSearch = todo.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  todoList.innerHTML = '';

  if (filtered.length === 0) {
    emptyMessage.style.display = 'block';
  } else {
    emptyMessage.style.display = 'none';

    filtered.forEach(todo => {
      const li = document.createElement('li');
      li.className = `todo-item${todo.completed ? ' completed' : ''}`;
      li.dataset.id = todo.id;

      // 1. 체크박스
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-checkbox';
      checkbox.checked = todo.completed;
      checkbox.addEventListener('change', () => toggleTodo(todo.id));
      li.appendChild(checkbox);

      // 2. 카테고리 태그
      const tag = document.createElement('span');
      tag.className = `category-tag ${todo.category}`;
      tag.textContent = CATEGORY_NAMES[todo.category] || '개인';
      li.appendChild(tag);

      // 3. 텍스트 / 인라인 편집 영역
      if (editingId === todo.id) {
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'todo-edit-input';
        editInput.value = todo.text;

        let isCanceled = false;

        const saveEdit = () => {
          if (isCanceled) return;
          const trimmed = editInput.value.trim();
          if (trimmed) {
            todo.text = trimmed;
            saveTodos();
          }
          editingId = null;
          render();
        };

        editInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            saveEdit();
          } else if (e.key === 'Escape') {
            isCanceled = true;
            editingId = null;
            render();
          }
        });

        editInput.addEventListener('blur', () => {
          saveEdit();
        });

        li.appendChild(editInput);
        setTimeout(() => {
          editInput.focus();
          editInput.select();
        }, 0);
      } else {
        const textSpan = document.createElement('span');
        textSpan.className = 'todo-text';
        textSpan.textContent = todo.text;
        textSpan.title = '더블클릭하여 수정';

        // 더블클릭 수정 이벤트
        textSpan.addEventListener('dblclick', () => {
          editingId = todo.id;
          render();
        });

        li.appendChild(textSpan);
      }

      // 4. 삭제 (X) 버튼
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = '삭제';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTodo(todo.id);
      });
      li.appendChild(deleteBtn);

      todoList.appendChild(li);
    });
  }

  updateProgress();
}

// 할 일 추가
function addTodo(text, category) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const newTodo = {
    id: Date.now().toString(),
    text: trimmed,
    category: category || 'personal',
    completed: false
  };

  todos.push(newTodo);
  saveTodos();
  render();
}

// 완료 상태 토글
function toggleTodo(id) {
  const target = todos.find(t => t.id == id);
  if (target) {
    target.completed = !target.completed;
    saveTodos();
    render();
  }
}

// 할 일 삭제
function deleteTodo(id) {
  todos = todos.filter(t => t.id != id);
  saveTodos();
  render();
}

// 이벤트 리스너 등록

// 폼 등록 (추가 버튼 및 Enter)
todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addTodo(todoInput.value, categorySelect.value);
  todoInput.value = '';
  todoInput.focus();
});

// 실시간 검색
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  render();
});

// 카테고리 필터 버튼 클릭
filterGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  currentFilter = btn.dataset.filter;
  render();
});

// 완료된 항목 일괄 삭제
clearCompletedBtn.addEventListener('click', () => {
  const completedCount = todos.filter(t => t.completed).length;
  if (completedCount === 0) {
    alert('완료된 항목이 없습니다.');
    return;
  }

  if (confirm('완료된 항목을 모두 삭제하시겠습니까?')) {
    todos = todos.filter(t => !t.completed);
    saveTodos();
    render();
  }
});

// 초기 실행
render();
