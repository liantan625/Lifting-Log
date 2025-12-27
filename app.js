import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc, writeBatch, updateDoc
} from "firebase/firestore";

// ======================================
// 1) FIREBASE / FIRESTORE INITIALIZATION
// ======================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// ======================================

// --- ELEMENT REFS ---
// Auth Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authTitle = document.getElementById('auth-title');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmit = document.getElementById('auth-submit');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const logoutBtn = document.getElementById('logout-btn');

// Tabs & Views
const tabLog = document.getElementById('tab-log');
const tabAnalytics = document.getElementById('tab-analytics');
const viewLog = document.getElementById('view-log');
const viewAnalytics = document.getElementById('view-analytics');

// Analytics Elements
const lastWorkoutText = document.getElementById('last-workout-text');
const chartExerciseSelect = document.getElementById('chart-exercise-select');
const ctx = document.getElementById('progress-chart').getContext('2d');
let chartInstance = null;

// App Elements
const dateInput = document.getElementById('date');
const exerciseSelect = document.getElementById('exercise');
const addExerciseBtn = document.getElementById('add-exercise');
const form = document.getElementById('log-form');
const tbody = document.querySelector('#log-table tbody');
const clearAllBtn = document.getElementById('clear-all');
const exportCsvBtn = document.getElementById('export-csv');
const tipBtn = document.getElementById('tip-btn');
const addEntryBtn = document.getElementById('add-entry');
const cancelEditBtn = document.getElementById('cancel-edit');

const EX_KEY = 'myLiftExercises';
// COLLECTION_NAME will be dynamic based on user
let currentUser = null;
let editingId = null; // Track which ID is being edited

// --- INITIAL DATA ---
let entries = [];
let exercises = JSON.parse(localStorage.getItem(EX_KEY) || '[]');

// Default exercises
const defaultExercises = [
  'Deadlift',
  'Bench Press',
  'Pulldown',
  'Dumbbell Side Raise',
  'Side bend',
  'Bulgarian Split Squat',
  'Overhead Press',
  'Machine Row',
  'Cable crunch',
  'BarbellSquat',
  'Face pull',
  'Triceps pushdown',
  'Biceps curl',
  'Crunch',
  'Bench press',
  'Dumbbell side raise'
];

// =============================
// 2) AUTHENTICATION LOGIC
// =============================

let isLoginMode = true;

authSwitchBtn.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = 'Login';
    authSubmit.textContent = 'Login';
    authSwitchText.innerHTML = 'Don\'t have an account? <span id="auth-switch-btn" class="link-btn">Sign Up</span>';
  } else {
    authTitle.textContent = 'Sign Up';
    authSubmit.textContent = 'Sign Up';
    authSwitchText.innerHTML = 'Already have an account? <span id="auth-switch-btn" class="link-btn">Login</span>';
  }
  // Re-attach listener to the new span
  document.getElementById('auth-switch-btn').addEventListener('click', () => authSwitchBtn.click());
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authEmail.value;
  const password = authPassword.value;

  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    console.error("Auth Error:", error);
    alert(error.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    currentUser = user;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    fetchWorkouts(); // Load data for this user
  } else {
    // User is signed out
    currentUser = null;
    entries = []; // Clear local data
    render();
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    authForm.reset();
  }
});


// =============================
// 3) FIRESTORE-BASED API FUNCTIONS
// =============================

function getUserCollection() {
  if (!currentUser) throw new Error("No user logged in");
  return collection(db, `users/${currentUser.uid}/workouts`);
}

// Fetch all workouts from Firestore
async function fetchWorkouts() {
  if (!currentUser) return;
  try {
    const querySnapshot = await getDocs(getUserCollection());
    // Map each document into your `entries` array, including its Firestore ID as `_id`
    entries = querySnapshot.docs.map(doc => ({
      _id: doc.id,
      ...doc.data()
    }));
    // Sort by date descending (optional but good)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    render();
    updateAnalytics(); // Update stats/charts when data loads
  } catch (error) {
    console.error('Error fetching workouts from Firestore:', error);
    alert('Failed to load workouts.');
  }
}

// Add a new workout to Firestore
async function addWorkout(workoutData) {
  if (!currentUser) return;
  try {
    // Firestore addDoc returns a DocumentReference
    const docRef = await addDoc(getUserCollection(), workoutData);

    // We can immediately push a local copy into `entries` (with the new ID)
    const newWorkout = {
      _id: docRef.id,
      ...workoutData
    };
    entries.unshift(newWorkout);
    // Sort again
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    render();
    updateAnalytics(); // Update stats/charts
  } catch (error) {
    console.error('Error adding workout to Firestore:', error);
    alert('Failed to save workout. Please try again!');
  }
}

// Update an existing workout in Firestore
async function updateWorkout(id, workoutData) {
  if (!currentUser) return;
  try {
    const docRef = doc(db, `users/${currentUser.uid}/workouts`, id);
    await updateDoc(docRef, workoutData);

    // Update local entry
    const index = entries.findIndex(e => e._id === id);
    if (index !== -1) {
      entries[index] = { _id: id, ...workoutData };
      // Sort again
      entries.sort((a, b) => new Date(b.date) - new Date(a.date));
      render();
      updateAnalytics();
    }
  } catch (error) {
    console.error('Error updating workout:', error);
    alert('Failed to update workout.');
  }
}

// Delete a single workout by Firestore document ID
async function deleteWorkout(id) {
  if (!currentUser) return;
  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/workouts`, id));
    // Remove it locally as well
    entries = entries.filter(entry => entry._id !== id);
    render();
    updateAnalytics(); // Update stats/charts
  } catch (error) {
    console.error('Error deleting workout from Firestore:', error);
    alert('Failed to delete workout. Please try again!');
  }
}

// Clear all workouts: delete every document in the "workouts" collection
async function clearAllWorkouts() {
  if (!currentUser) return;
  try {
    const querySnapshot = await getDocs(getUserCollection());
    // Batch‐delete or loop through each doc
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    entries = [];
    render();
    updateAnalytics();
  } catch (error) {
    console.error('Error clearing workouts from Firestore:', error);
    alert('Failed to clear workouts. Please try again!');
  }
}

// =================
// 4) ON LOAD SETUP
// =================
window.addEventListener('DOMContentLoaded', () => {
  // 1. Set date to today
  dateInput.value = new Date().toISOString().slice(0, 10);

  // 2. Initialize exercises list (still using localStorage for exercises)
  if (!exercises.length) {
    exercises = defaultExercises.slice();
    localStorage.setItem(EX_KEY, JSON.stringify(exercises));
  } else {
    // Merge new default exercises if they don't exist
    let changed = false;
    defaultExercises.forEach(ex => {
      if (!exercises.includes(ex)) {
        exercises.push(ex);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(EX_KEY, JSON.stringify(exercises));
    }
  }
  populateExercises();

  // 3. Load workouts from Firestore -> Moved to onAuthStateChanged
});

// Populate the <select> with exercises
function populateExercises() {
  const options = exercises
    .map(ex => `<option value="${ex}">${ex}</option>`)
    .join('');

  exerciseSelect.innerHTML = options;
  chartExerciseSelect.innerHTML = options; // Populate chart select too
}

// ================
// 5) EVENT LISTENERS
// ================

// Tabs
tabLog.addEventListener('click', () => {
  tabLog.classList.add('active');
  tabAnalytics.classList.remove('active');
  viewLog.classList.remove('hidden');
  viewAnalytics.classList.add('hidden');
});

tabAnalytics.addEventListener('click', () => {
  tabAnalytics.classList.add('active');
  tabLog.classList.remove('active');
  viewAnalytics.classList.remove('hidden');
  viewLog.classList.add('hidden');
  updateAnalytics(); // Refresh chart when switching tab
});

// Chart Exercise Change
chartExerciseSelect.addEventListener('change', () => {
  renderChart();
});

// Add a new custom exercise (still using localStorage)
addExerciseBtn.addEventListener('click', () => {
  const name = prompt('Enter new exercise name:')?.trim();
  if (name && !exercises.includes(name)) {
    exercises.push(name);
    localStorage.setItem(EX_KEY, JSON.stringify(exercises));
    populateExercises();
    exerciseSelect.value = name;
  }
});

// On form submit, add a new log entry to Firestore
form.addEventListener('submit', async e => {
  e.preventDefault();

  const workoutData = {
    date: dateInput.value,
    exercise: exerciseSelect.value,
    weight: +document.getElementById('weight').value,
    reps: +document.getElementById('reps').value,
    note: document.getElementById('note').value.trim()
  };

  if (editingId) {
    // Update existing
    await updateWorkout(editingId, workoutData);
    alert('Workout updated!');
    cancelEdit(); // Reset form state
  } else {
    // Add new
    await addWorkout(workoutData);
    alert('Workout added!');
    form.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
});

// Cancel Edit
cancelEditBtn.addEventListener('click', cancelEdit);

function cancelEdit() {
  editingId = null;
  form.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  addEntryBtn.textContent = 'Add Entry';
  cancelEditBtn.classList.add('hidden');
}

// Start Edit
function startEdit(id) {
  const entry = entries.find(e => e._id === id);
  if (!entry) return;

  editingId = id;

  // Populate form
  dateInput.value = entry.date;
  exerciseSelect.value = entry.exercise;
  document.getElementById('weight').value = entry.weight;
  document.getElementById('reps').value = entry.reps;
  document.getElementById('note').value = entry.note;

  // Change UI to Edit Mode
  addEntryBtn.textContent = 'Update Entry';
  cancelEditBtn.classList.remove('hidden');

  // Switch to Log Tab
  tabLog.click();
}

// Clear all entries (asks for confirmation, then deletes all Firestore docs)
clearAllBtn.addEventListener('click', async () => {
  if (!entries.length) return;
  if (confirm('Erase all entries?')) {
    await clearAllWorkouts();
  }
});

// Export log to CSV (uses the local `entries[]` array)
exportCsvBtn.addEventListener('click', () => {
  if (!entries.length) {
    alert('No entries to export.');
    return;
  }
  const header = ['Date', 'Exercise', 'Weight (kg)', 'Reps', 'Note'];
  const rows = entries.map(e =>
    [e.date, e.exercise, e.weight, e.reps, e.note]
      .map(val => `"${val}"`).join(',')
  );
  const csv = [header.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lift-log.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// "Tip Me" button (unchanged)
tipBtn.addEventListener('click', () => {
  window.location.href = 'https://buy.stripe.com/7sI9BB8OY2rh5ZCbII';
});

// Delete a single entry (clicking the “✕” button in the table)
tbody.addEventListener('click', async e => {
  const id = e.target.dataset.id;
  if (e.target.matches('.delete')) {
    if (confirm('Delete this entry?')) {
      await deleteWorkout(id);
    }
  } else if (e.target.matches('.edit-btn')) {
    startEdit(id);
  }
});

// ================
// 6) RENDER FUNCTION
// ================
function render() {
  tbody.innerHTML = entries.map(entry => {
    const id = entry._id || entry.id; // If you ever switch to MongoDB, it’ll also work
    return `
      <tr>
        <td>${entry.date}</td>
        <td>${entry.exercise}</td>
        <td>${entry.weight} kg</td>
        <td>${entry.reps}</td>
        <td>${entry.note}</td>
        <td>
          <button class="edit-btn" data-id="${id}">✎</button>
          <button class="delete" data-id="${id}">✕</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ================
// 7) ANALYTICS FUNCTIONS
// ================

function updateAnalytics() {
  updateLastWorkoutStats();
  renderChart();
}

function updateLastWorkoutStats() {
  if (entries.length === 0) {
    lastWorkoutText.textContent = "No data yet";
    return;
  }

  // entries is already sorted by date desc
  const lastDate = new Date(entries[0].date);
  const today = new Date();

  // Reset time part for accurate day calculation
  lastDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(today - lastDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    lastWorkoutText.textContent = "Today";
  } else if (diffDays === 1) {
    lastWorkoutText.textContent = "Yesterday";
  } else {
    lastWorkoutText.textContent = `${diffDays} days ago`;
  }
}

function renderChart() {
  const selectedExercise = chartExerciseSelect.value;

  const exerciseData = entries
    .filter(e => e.exercise === selectedExercise)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const labels = exerciseData.map(e => e.date);
  // CHANGE 1: Create a parallel array for Reps
  const dataPoints = exerciseData.map(e => e.weight);
  const repPoints = exerciseData.map(e => e.reps); 

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${selectedExercise} Weight (kg)`,
        data: dataPoints,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
        fill: true,
        // CHANGE 2: Dynamic Point Radius
        // Visualizes volume: Big dot = High Reps, Small dot = Low Reps
        pointRadius: (context) => {
            const index = context.dataIndex;
            const reps = repPoints[index];
            // Base size 3px + 0.5px per rep. 
            // 5 reps = 5.5px size
            // 15 reps = 10.5px size
            return 3 + (reps ? reps * 0.5 : 0); 
        },
        pointHoverRadius: (context) => {
            const index = context.dataIndex;
            const reps = repPoints[index];
            return 5 + (reps ? reps * 0.5 : 0);
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: false }
      },
      // CHANGE 3: Custom Tooltip to show "Weight x Reps"
      plugins: {
        tooltip: {
            callbacks: {
                label: function(context) {
                    const weight = context.parsed.y;
                    const index = context.dataIndex;
                    const reps = repPoints[index];
                    return `${weight}kg × ${reps} reps`;
                }
            }
        }
      }
    }
  });
}
