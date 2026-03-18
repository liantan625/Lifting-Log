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
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc
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
const logoutBtn = document.getElementById('settings-logout-btn');

// Page Views
const viewLog = document.getElementById('view-log');
const viewAnalytics = document.getElementById('view-analytics');
const viewSettings = document.getElementById('view-settings');
const allPageViews = [viewLog, viewAnalytics, viewSettings];

// Bottom Nav
const navItems = document.querySelectorAll('.nav-item');

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
const exportCsvBtn = document.getElementById('export-csv');
const tipBtn = document.getElementById('tip-btn');
const addEntryBtn = document.getElementById('add-entry');
const cancelEditBtn = document.getElementById('cancel-edit');

const EX_KEY = 'myLiftExercises'; // kept only for one-time migration read
let currentUser = null;
let editingId = null; // Track which ID is being edited

// --- INITIAL DATA ---
let entries = [];
let exercises = [];

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
    fetchWorkouts(); // Loads workouts AND exercises (with backfill)
  } else {
    // User is signed out
    currentUser = null;
    entries = [];
    exercises = defaultExercises.slice();
    populateExercises();
    render();
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    authForm.reset();
    switchPage('view-log');
  }
});


// =============================
// 3) FIRESTORE-BASED API FUNCTIONS
// =============================

function getUserCollection() {
  if (!currentUser) throw new Error("No user logged in");
  return collection(db, `users/${currentUser.uid}/workouts`);
}

function getUserExercisesCollection() {
  if (!currentUser) throw new Error("No user logged in");
  return collection(db, `users/${currentUser.uid}/exercises`);
}

// Save a single exercise name to Firestore (uses name as doc ID to avoid duplicates)
async function saveExerciseToFirestore(name) {
  if (!currentUser) return;
  try {
    const docRef = doc(db, `users/${currentUser.uid}/exercises`, encodeURIComponent(name));
    await setDoc(docRef, { name }, { merge: true });
  } catch (error) {
    console.error('Error saving exercise to Firestore:', error);
  }
}

// Fetch exercises from Firestore, backfill from localStorage + workout entries, then sync
async function fetchExercises(workoutDerivedNames = []) {
  if (!currentUser) return;
  try {
    const snapshot = await getDocs(getUserExercisesCollection());
    const firestoreNames = snapshot.docs.map(d => d.data().name).filter(Boolean);

    // One-time migration: read any exercises stored in localStorage
    const localNames = JSON.parse(localStorage.getItem(EX_KEY) || '[]');

    // Merge all sources: defaults + firestore + localStorage + workout-derived
    const allNames = new Set([
      ...defaultExercises,
      ...firestoreNames,
      ...localNames,
      ...workoutDerivedNames
    ]);

    exercises = [...allNames].sort();
    populateExercises();

    // Write any names not yet in Firestore (backfill)
    const toWrite = [...allNames].filter(n => !firestoreNames.includes(n));
    await Promise.all(toWrite.map(n => saveExerciseToFirestore(n)));

    // Clear localStorage after successful migration
    if (localNames.length > 0) {
      localStorage.removeItem(EX_KEY);
    }
  } catch (error) {
    console.error('Error fetching exercises from Firestore:', error);
  }
}

// Fetch all workouts from Firestore, then fetch/backfill exercises
async function fetchWorkouts() {
  if (!currentUser) return;
  try {
    const querySnapshot = await getDocs(getUserCollection());
    entries = querySnapshot.docs.map(doc => ({
      _id: doc.id,
      ...doc.data()
    }));
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    render();
    updateAnalytics();

    // Extract unique exercise names from all existing workout entries (backfill source)
    const workoutDerivedNames = [...new Set(entries.map(e => e.exercise).filter(Boolean))];
    await fetchExercises(workoutDerivedNames);
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

// =================
// 4) ON LOAD SETUP
// =================
window.addEventListener('DOMContentLoaded', () => {
  // Set date to today
  dateInput.value = new Date().toISOString().slice(0, 10);

  // Populate dropdowns with defaults as a placeholder while Firestore loads
  exercises = defaultExercises.slice().sort();
  populateExercises();

  // Workouts + exercises are fully loaded in onAuthStateChanged → fetchWorkouts()
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
// 5) PAGE SWITCHING (BOTTOM NAV)
// ================

function switchPage(pageId) {
  // Hide all page views
  allPageViews.forEach(view => view.classList.add('hidden'));

  // Show the target page
  const target = document.getElementById(pageId);
  if (target) target.classList.remove('hidden');

  // Update nav active states
  navItems.forEach(item => {
    if (item.dataset.page === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Refresh analytics when switching to that page
  if (pageId === 'view-analytics') {
    updateAnalytics();
  }
}

// Nav item click listeners
navItems.forEach(item => {
  item.addEventListener('click', () => {
    switchPage(item.dataset.page);
  });
});

// ================
// 6) EVENT LISTENERS
// ================

// Chart Exercise Change
chartExerciseSelect.addEventListener('change', () => {
  renderChart();
});

// Add a new custom exercise — saved to Firestore
addExerciseBtn.addEventListener('click', async () => {
  const name = prompt('Enter new exercise name:')?.trim();
  if (name && !exercises.includes(name)) {
    exercises.push(name);
    exercises.sort();
    populateExercises();
    exerciseSelect.value = name;
    await saveExerciseToFirestore(name);
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

  // Switch to Log Entry page
  switchPage('view-log');
}

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

// "Tip Me" button
tipBtn.addEventListener('click', () => {
  window.location.href = 'https://buy.stripe.com/7sI9BB8OY2rh5ZCbII';
});

// Delete a single entry (clicking the "✕" button in the table)
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
// 7) RENDER FUNCTION
// ================
function render() {
  tbody.innerHTML = entries.map(entry => {
    const id = entry._id || entry.id; // If you ever switch to MongoDB, it'll also work
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
// 8) ANALYTICS FUNCTIONS
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
  const weightPoints = exerciseData.map(e => e.weight);
  const volumePoints = exerciseData.map(e => e.weight * e.reps);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${selectedExercise} Weight (kg)`,
          data: weightPoints,
          yAxisID: 'yWeight',
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: `${selectedExercise} Volume (kg × reps)`,
          data: volumePoints,
          yAxisID: 'yVolume',
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.08)',
          tension: 0.3,
          fill: false,
          borderDash: [5, 4],
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        yWeight: {
          type: 'linear',
          position: 'left',
          beginAtZero: false,
          title: { display: true, text: 'Weight (kg)' },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        yVolume: {
          type: 'linear',
          position: 'right',
          beginAtZero: false,
          title: { display: true, text: 'Volume (kg × reps)' },
          grid: { drawOnChartArea: false }, // no double gridlines
        },
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (context) => {
              const val = context.parsed.y;
              if (context.dataset.yAxisID === 'yWeight') {
                const reps = exerciseData[context.dataIndex]?.reps;
                return `Weight: ${val} kg  (${reps} reps)`;
              }
              return `Volume: ${val} kg×reps`;
            }
          }
        }
      }
    }
  });
}
