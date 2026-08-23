export const environment = {
  /** Muss mit bootstrapEmail() in firestore.rules übereinstimmen. */
  bootstrapAdminEmail: 'jfknoack@gmail.com',
  /**
   * Google-Kalender-ID des Pflegekalenders (Einstellungen → Kalender integrieren).
   * Beispiel: abc123@group.calendar.google.com
   */
  googleCalendarId:
    'f34849b3f4df8422de3390bde1ac30d2f67bbdaa539c4ba58abbdbbf53c8dcad@group.calendar.google.com',
  firebase: {
    apiKey: 'AIzaSyApEX0hp9HZ0d_AjtKq9HtCCQYbscUeMoM',
    authDomain: 'mecfs-app-cce8b.firebaseapp.com',
    projectId: 'mecfs-app-cce8b',
    storageBucket: 'mecfs-app-cce8b.firebasestorage.app',
    messagingSenderId: '1093747693150',
    appId: '1:1093747693150:web:06db8b47a6c6f900b6c6cf',
  },
};
