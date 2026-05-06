export const firebaseConfig = {
  apiKey: "AIzaSyCtFKTMIXLIj5J0egOs9NBiM9ixUyTQ1tc",
  authDomain: "danova-evidence.firebaseapp.com",
  projectId: "danova-evidence",
  storageBucket: "danova-evidence.firebasestorage.app",
  messagingSenderId: "400201665276",
  appId: "1:400201665276:web:39bbd54903fa3f59d32579"
};

// Firestore pravidla (nastav v Firebase konzoli > Firestore > Rules):
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
*/
