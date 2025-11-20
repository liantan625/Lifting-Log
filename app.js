import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc, writeBatch
} from "firebase/firestore";

// ======================================
// 1) FIREBASE / FIRESTORE INITIALIZATION
// ======================================

const firebaseConfig = {
  apiKey: "AIzaSyC5SQpbZ0vQeWDNLZUTzCAZKi5Z4GIqdIg",
  authDomain: "lifting-log-24a4f.firebaseapp.com",
  databaseURL: "https://lifting-log-24a4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lifting-log-24a4f",
  storageBucket: "lifting-log-24a4f.firebasestorage.app",
  messagingSenderId: "834355525527",
  appId: "1:834355525527:web:811a8709f2a0013bf6f6d2",
  measurementId: "G-MCVK2NDV66"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// ======================================

// --- ELEMENT REFS ---
const dateInput = document.getElementById('date');
const exerciseSelect = document.getElementById('exercise');
const addExerciseBtn = document.getElementById('add-exercise');
const form = document.getElementById('log-form');
const tbody = document.querySelector('#log-table tbody');
const clearAllBtn = document.getElementById('clear-all');
const exportCsvBtn = document.getElementById('export-csv');
const tipBtn = document.getElementById('tip-btn');

const EX_KEY = 'myLiftExercises';
const COLLECTION_NAME = 'workouts'; // Firestore collection

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
  'Row',
  'Glute Bridge Hip Thrust',
  'Cable crunch',
  'Barbell press',
  'Squat',
  'Face pull',
  'Triceps pushdown',
  'Grip',
  'Biceps curl',
  'Single leg standing calf',
  'Crunch',
  'Bench press',
  'Dumbbell side raise'
];

// =============================
// 2) FIRESTORE-BASED API FUNCTIONS
// =============================

// Fetch all workouts from Firestore
async function fetchWorkouts() {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    // Map each document into your `entries` array, including its Firestore ID as `_id`
    entries = querySnapshot.docs.map(doc => ({
      _id: doc.id,
      ...doc.data()
    }));
    render();
  } catch (error) {
    console.error('Error fetching workouts from Firestore:', error);
    alert('Failed to load workouts. Make sure your Firebase setup is correct!');
  }
}

// Add a new workout to Firestore
async function addWorkout(workoutData) {
  try {
    // Firestore addDoc returns a DocumentReference
    const docRef = await addDoc(collection(db, COLLECTION_NAME), workoutData);

    // We can immediately push a local copy into `entries` (with the new ID)
    const newWorkout = {
      _id: docRef.id,
      ...workoutData
    };
    entries.unshift(newWorkout);
    render();
  } catch (error) {
    console.error('Error adding workout to Firestore:', error);
    alert('Failed to save workout. Please try again!');
  }
}

// Delete a single workout by Firestore document ID
async function deleteWorkout(id) {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    // Remove it locally as well
    entries = entries.filter(entry => entry._id !== id);
    render();
  } catch (error) {
    console.error('Error deleting workout from Firestore:', error);
    alert('Failed to delete workout. Please try again!');
  }
}

// Clear all workouts: delete every document in the "workouts" collection
async function clearAllWorkouts() {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    // Batch‐delete or loop through each doc
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    entries = [];
    render();
  } catch (error) {
    console.error('Error clearing workouts from Firestore:', error);
    alert('Failed to clear workouts. Please try again!');
  }
}

// =================
// 3) ON LOAD SETUP
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

  // 3. Load workouts from Firestore
  fetchWorkouts();
});

// Populate the <select> with exercises
function populateExercises() {
  exerciseSelect.innerHTML = exercises
    .map(ex => `<option value="${ex}">${ex}</option>`)
    .join('');
}

// ================
// 4) EVENT LISTENERS
// ================

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

  await addWorkout(workoutData);

  form.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
});

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
  if (!e.target.matches('.delete')) return;
  const id = e.target.dataset.id;
  await deleteWorkout(id);
});

// ================
// 5) RENDER FUNCTION
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
        <td><button class="delete" data-id="${id}">✕</button></td>
      </tr>
    `;
  }).join('');
}
