import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAD6zHVm8U13nM43YSwP-XEbRCSTmT1As4",
  authDomain: "strategic-progress2.firebaseapp.com",
  projectId: "strategic-progress2",
  storageBucket: "strategic-progress2.firebasestorage.app",
  messagingSenderId: "154116794788",
  appId: "1:154116794788:web:c7f368aa86cc0fe8503931",
  measurementId: "G-9X3N4BLVVX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };