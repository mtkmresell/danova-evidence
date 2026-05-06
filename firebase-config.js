// ============================================================
// FIREBASE KONFIGURACE - vyplň svými údaji z Firebase konzole
// ============================================================
// Jak získat údaje:
// 1. Jdi na https://console.firebase.google.com
// 2. Vytvoř nový projekt (např. "danova-evidence")
// 3. Klikni na ikonu </> (Web app) pro přidání webové aplikace
// 4. Zkopíruj firebaseConfig objekt a nahraď hodnoty níže
// 5. V Firebase konzoli povol:
//    - Authentication > Sign-in method > Email/Password
//    - Firestore Database > Create database (production mode)
// ============================================================

const firebaseConfig = {
  apiKey: "TVUJ-API-KEY",
  authDomain: "TVUJ-PROJEKT.firebaseapp.com",
  projectId: "TVUJ-PROJEKT-ID",
  storageBucket: "TVUJ-PROJEKT.appspot.com",
  messagingSenderId: "TVOJE-SENDER-ID",
  appId: "TVOJE-APP-ID"
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
