# Lifting Log 🏋️

A simple and elegant web application for tracking your weightlifting workouts. Log your exercises, track your progress, and export your data—all stored in the cloud with Firebase.

## Features

- **📝 Easy Logging**: Quickly add workout entries with date, exercise, weight, reps, and optional notes
- **🎯 Custom Exercises**: Add your own exercises beyond the 18+ pre-loaded defaults
- **☁️ Cloud Storage**: All workout data is stored in Firebase Firestore for access from any device
- **📊 Data Export**: Export your entire workout history to CSV for analysis
- **🗑️ Flexible Management**: Delete individual entries or clear all data with confirmation
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices

## Pre-loaded Exercises

The app comes with 18 common exercises:
- Deadlift
- Bench Press
- Squat
- Pulldown
- Overhead Press
- Row
- Bulgarian Split Squat
- Dumbbell Side Raise
- Barbell Press
- Glute Bridge Hip Thrust
- Face Pull
- Triceps Pushdown
- Biceps Curl
- Cable Crunch
- Side Bend
- Single Leg Standing Calf
- Grip
- Crunch

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase (Firestore, Analytics)
- **Build Tool**: Vite
- **Styling**: Custom CSS with responsive design

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account (already configured in this project)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/liantan625/Lifting-Log.git
cd Lifting-Log
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open your browser and navigate to the local development URL (typically `http://localhost:5173`)

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Add an Entry**: 
   - Select the date (defaults to today)
   - Choose an exercise from the dropdown
   - Enter weight (in kg) and number of reps
   - Optionally add a note
   - Click "Add Entry"

2. **Add Custom Exercise**:
   - Click the "+ Add Exercise" button
   - Enter the exercise name
   - It will be saved and available for future workouts

3. **Delete an Entry**:
   - Click the "✕" button next to any entry in the table

4. **Export Data**:
   - Click "Export to CSV" to download all your workout data

5. **Clear All Data**:
   - Click "Clear All" and confirm to remove all entries

## Firebase Configuration

This project uses Firebase for data storage. The Firebase configuration is already set up in `app.js`. If you want to use your own Firebase project:

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Replace the `firebaseConfig` object in `app.js` with your project's configuration

## Project Structure

```
Lifting-Log/
├── index.html          # Main HTML file
├── app.js              # Core JavaScript logic with Firebase integration
├── style.css           # Styling
├── package.json        # Dependencies and scripts
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

ISC

## Support

If you find this project helpful, consider supporting development by clicking the "💖 Tip Me" button in the app!

## Author

Created by [liantan625](https://github.com/liantan625)
