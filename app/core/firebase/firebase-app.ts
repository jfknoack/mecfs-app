import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

let app: FirebaseApp | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(environment.firebase.apiKey && environment.firebase.appId);
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase ist nicht konfiguriert.');
  }
  app ??= initializeApp(environment.firebase);
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function firebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
