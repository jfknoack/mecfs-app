# ME/CFS App

Web-App zur Alltagsorganisation bei ME/CFS: Listen, Routinen, Rezepte, Budget, Kalender und Pacing. Anmeldung nur über Google und nur für hinterlegte Konten.

## Ist-Stand

- **Anmeldung:** Google-Login. Nur E-Mail-Adressen in `allowedUsers` kommen rein. Die Super-User-Adresse steht nicht im Code, sondern in Firestore (`config/app`).
- **Rollen:** `user` (Alltag), `admin` (Pflege der Inhalte und Benutzer), `patient` (wie Admin, plus Pacing). Der Super-User ist immer Admin und sieht Pacing.
- **Daten:** Listen, Routinen, Rezepte, Budget und Pacing liegen in Cloud Firestore.
- **Kalender:** Routinen lokal in der App, Pflegetermine über die Google-Calendar-API. Die Kalender-ID kommt aus Firestore, nicht aus dem Repository.
- **PWA:** Produktions-Build mit Service Worker, Hosting auf Firebase.

Die Firebase-Web-Kennungen in `src/environments/environment.ts` (`apiKey`, `projectId`, …) sind **öffentliche Client-IDs**. Sie stehen nach dem Build sowieso im JavaScript. Schutz kommt von:

- autorisierten Domains in Firebase Authentication
- HTTP-Referrer-Beschränkung des API-Keys in Google Cloud (empfohlen)
- Firestore-Sicherheitsregeln

Persönliche Daten (Super-User-E-Mail, Kalender-ID) gehören **nicht** ins Git.

## Voraussetzungen

- Node.js 22 (oder die in `package.json` unter `engines` genannte Version)
- npm (öffentliche Registry, siehe `.npmrc`)
- Google-Konto für Firebase
- Firebase CLI lokal: `npx firebase-tools` oder global `npm i -g firebase-tools`

```bash
git clone <dein-repo>
cd mecfs-app
npm ci
npm start
```

Die App läuft unter `http://localhost:4200/`. Ohne Firebase-Projekt und ohne `config/app` ist Login nicht möglich.

## Firebase-Projekt anlegen

1. Unter [Firebase Console](https://console.firebase.google.com/) ein Projekt anlegen (Blaze ist nicht nötig, Spark reicht für den Start).
2. **Authentication → Sign-in method → Google** aktivieren. Die Support-E-Mail setzen.
3. **Authentication → Settings → Authorized domains:** `localhost` belassen und die Hosting-Domain ergänzen (z. B. `mecfs-app-cce8b.web.app`).
4. **Firestore Database** im Modus *Production* anlegen (Region z. B. `europe-west3`). Die Regeln kommen aus dem Repo, nicht aus den Console-Defaults.
5. **Hosting** im Projekt aktivieren.
6. Web-App hinzufügen (**Project settings → Your apps → Web**). Die angezeigten Werte nach `src/environments/environment.ts` übernehmen (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
7. `.firebaserc` auf die eigene `projectId` setzen, falls du ein neues Projekt nutzt.

Lokal mit dem Projekt verbinden:

```bash
npx firebase-tools login
npx firebase-tools use --add
```

Google Calendar API in der [Google Cloud Console](https://console.cloud.google.com/) desselben Projekts aktivieren (**APIs & Services → Enable APIs → Google Calendar API**).

## Firestore-Regeln und Indexes

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Ohne diesen Schritt gelten die Regeln in `firestore.rules` nicht. Die GitHub-Action deployt die Regeln bei jedem Push auf `main` mit.

## App-Konfiguration in Firestore

Persönliche Einstellungen liegen in **einem** Dokument, das du in der Console anlegst (Owner/Editor umgeht die Client-Regeln).

1. Firestore → **Daten** → **Sammlung starten**
2. Sammlungs-ID: `config`
3. Dokument-ID: `app`
4. Felder:

| Feld | Typ | Inhalt |
|---|---|---|
| `bootstrapAdminEmail` | string | Google-E-Mail des Super-Users, kleingeschrieben |
| `googleCalendarId` | string | Kalender-ID, z. B. `…@group.calendar.google.com` |

Beispiel:

- `bootstrapAdminEmail` = `du@gmail.com`
- `googleCalendarId` = `xxxxxxxx@group.calendar.google.com`

**Reihenfolge beim ersten Start:** zuerst `config/app` anlegen, **dann** mit genau dieser Google-Adresse einloggen. Der Super-User wird automatisch Admin und in `allowedUsers` eingetragen. Weitere Personen legst du in der App unter **Admin** an.

Die Kalender-ID findest du in Google Kalender: Einstellungen des Kalenders → **Kalender integrieren** → **Kalender-ID**. Denselben Kalender mit jedem Google-Konto teilen, das Termine sehen oder schreiben soll (mindestens *Termine ändern*).

Das Dokument darf Clients nur lesen. Änderungen nur über die Firebase Console.

**Bestehende Installation:** Zuerst `config/app` in der Console anlegen (mit der bisherigen Super-User-E-Mail und der Kalender-ID), danach Regeln und Hosting deployen. Sonst schlägt der Super-User-Login fehl, sobald der neue Code live ist.

## Deployment

### Lokal

```bash
npm run build
npx firebase-tools deploy --only hosting
```

Alles (Hosting + Firestore):

```bash
npm run deploy:all
```

### GitHub Actions

Bei Push auf `main` (Workflow `.github/workflows/firebase-hosting.yml`):

1. In Firebase: **Project settings → Service accounts → Generate new private key**
2. In GitHub: **Settings → Secrets and variables → Actions**
3. Secret anlegen: `FIREBASE_SERVICE_ACCOUNT_MECFS_APP_CCE8B` mit dem kompletten JSON der Schlüsseldatei
4. Workflow-`projectId` und Secret-Name an das eigene Firebase-Projekt anpassen, falls abweichend

Der Workflow installiert Abhängigkeiten von `registry.npmjs.org`, deployt Firestore-Regeln und danach Hosting.

## npm-Registry

`.npmrc` und `package-lock.json` zeigen auf `https://registry.npmjs.org/`. Keine interne Registry eintragen. Nach einem `npm install` die Lockdatei prüfen, bevor du committest.

## Entwicklung

| Befehl | Zweck |
|---|---|
| `npm start` | Dev-Server |
| `npm test` | Unit-Tests (Vitest) |
| `npm run build` | Produktions-Build nach `dist/` |

Im Dev-Modus kann ein eingeloggter Admin die UI-Rolle wechseln (Vorschau), ohne die echte Rolle in Firestore zu ändern.
