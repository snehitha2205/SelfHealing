const taskInput = document.querySelector('#task-input');
const addButton = document.querySelector('#add-todo-btn');
const todoList = document.querySelector('#todo-list');

let tasks = [];

function renderTasks() {
  todoList.innerHTML = '';

  tasks.forEach((task) => {
    const item = document.createElement('li');
    item.className = `todo-item ${task.completed ? 'completed' : ''}`;

    const main = document.createElement('div');
    main.className = 'todo-main';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Mark ${task.text} complete`);
    checkbox.addEventListener('change', () => {
      task.completed = checkbox.checked;
      renderTasks();
    });

    const label = document.createElement('span');
    label.className = 'todo-label';
    label.textContent = task.text;

    main.appendChild(checkbox);
    main.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.className = 'todo-action-btn primary';
    completeButton.textContent = task.completed ? 'Undo' : 'Complete';
    completeButton.addEventListener('click', () => {
      task.completed = !task.completed;
      renderTasks();
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'todo-action-btn danger';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      tasks = tasks.filter((itemTask) => itemTask.id !== task.id);
      renderTasks();
    });

    actions.appendChild(completeButton);
    actions.appendChild(deleteButton);
    item.appendChild(main);
    item.appendChild(actions);
    todoList.appendChild(item);
  });
}

function addTask() {
  const value = taskInput.value.trim();
  if (!value) {
    taskInput.focus();
    return;
  }

  tasks.push({
    id: Date.now() + Math.random(),
    text: value,
    completed: false
  });

  taskInput.value = '';
  renderTasks();
  taskInput.focus();
}

addButton.addEventListener('click', addTask);

taskInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    addTask();
  }
});

renderTasks();
