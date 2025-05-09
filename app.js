// --- ELEMENT REFS ---
const dateInput       = document.getElementById('date');
const exerciseSelect  = document.getElementById('exercise');
const addExerciseBtn  = document.getElementById('add-exercise');
const form            = document.getElementById('log-form');
const tbody           = document.querySelector('#log-table tbody');
const clearAllBtn     = document.getElementById('clear-all');
const exportCsvBtn    = document.getElementById('export-csv');
const tipBtn          = document.getElementById('tip-btn');

const STORAGE_KEY     = 'myLiftLog';
const EX_KEY          = 'myLiftExercises';

// --- INITIAL DATA ---
let entries   = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let exercises = JSON.parse(localStorage.getItem(EX_KEY)      || '[]');

// Default exercises
const defaultExercises = [
  'Barbell press','Pulldown','Squat','Dumbbell side raise','Face pull','Triceps pushdown','Grip',
  'Bench press','Deadlift','Biceps curl','Single leg standing calf','Crunch','Side bend'
];

// --- ON LOAD ---
window.addEventListener('DOMContentLoaded', () => {
  // 1. Set date to today
  dateInput.value = new Date().toISOString().slice(0,10);

  // 2. Initialize exercises list
  if (!exercises.length) {
    exercises = defaultExercises.slice();
    localStorage.setItem(EX_KEY, JSON.stringify(exercises));
  }
  populateExercises();

  // 3. Render existing entries
  render();
});

// Populate the <select> with exercises
function populateExercises() {
  exerciseSelect.innerHTML = exercises
    .map(ex => `<option value="${ex}">${ex}</option>`)
    .join('');
}

// Save entries array back to localStorage
function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// --- EVENT LISTENERS ---

// Add a new custom exercise
addExerciseBtn.addEventListener('click', () => {
  const name = prompt('Enter new exercise name:').trim();
  if (name && !exercises.includes(name)) {
    exercises.push(name);
    localStorage.setItem(EX_KEY, JSON.stringify(exercises));
    populateExercises();
    exerciseSelect.value = name;
  }
});

// On form submit, add a new log entry
form.addEventListener('submit', e => {
  e.preventDefault();
  const entry = {
    id:       Date.now(),
    date:     dateInput.value,
    exercise: exerciseSelect.value,
    weight:   +document.getElementById('weight').value,
    reps:     +document.getElementById('reps').value,
    note:     document.getElementById('note').value.trim()
  };
  entries.unshift(entry);
  saveEntries();
  render();
  form.reset();
  dateInput.value = new Date().toISOString().slice(0,10);
});

// Clear all entries
clearAllBtn.addEventListener('click', () => {
  if (!entries.length) return;
  if (confirm('Erase all entries?')) {
    entries = [];
    saveEntries();
    render();
  }
});

// Export log to CSV
exportCsvBtn.addEventListener('click', () => {
  if (!entries.length) {
    alert('No entries to export.');
    return;
  }
  const header = ['Date','Exercise','Weight (kg)','Reps','Note'];
  const rows = entries.map(e =>
    [e.date, e.exercise, e.weight, e.reps, e.note]
      .map(val => `"${val}"`).join(',')
  );
  const csv = [header.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href       = url;
  a.download   = 'lift-log.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// “Tip Me” button
tipBtn.addEventListener('click', () => {
  window.location.href = 'https://buy.stripe.com/7sI9BB8OY2rh5ZCbII';
});

// Delete a single entry
tbody.addEventListener('click', e => {
  if (!e.target.matches('.delete')) return;
  const id = +e.target.dataset.id;
  entries = entries.filter(ent => ent.id !== id);
  saveEntries();
  render();
});

// Render the table rows
function render() {
  tbody.innerHTML = entries.map(({id,date,exercise,weight,reps,note}) => `
    <tr>
      <td>${date}</td>
      <td>${exercise}</td>
      <td>${weight} kg</td>
      <td>${reps}</td>
      <td>${note}</td>
      <td><button class="delete" data-id="${id}">✕</button></td>
    </tr>
  `).join('');
}
