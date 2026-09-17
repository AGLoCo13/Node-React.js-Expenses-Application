# Έλεγχος Report 2 vs. πραγματικό σύστημα (17/9/2026)

Βάση: πλήρες κείμενο του `ais25121_ais25130_itp24110_Cloud Native_Report 2.docx` (612 γραμμές + 10 πίνακες), αντιπαραβαλλόμενο με ό,τι επαληθεύσαμε ζωντανά σήμερα (κώδικας, ArgoCD, Jenkins, live dashboard, evidence files στο repo).

Η καλή είδηση: το πρόγραμμα είναι **πιο μπροστά** από ό,τι λέει το ίδιο το report. Τα παρακάτω είναι σημεία όπου το report υποτιμά τη δουλειά σας — αξίζει να διορθωθούν πριν την παράδοση, γιατί αλλιώς ο βαθμολογητής θα νομίζει ότι λείπουν πράγματα που στην πραγματικότητα έχετε ήδη υλοποιήσει και αποδείξει.

---

## 1. Τα 3 μεγάλα λάθη (πρέπει να διορθωθούν)

### 1.1 "Το notification pipeline είναι μελλοντική επέκταση" → ΛΑΘΟΣ, είναι έτοιμο

Στα κεφάλαια 2.3 και 3.3 γράφετε ότι η "περαιτέρω μετατροπή [του IoT alarm] σε αποθηκευμένη ειδοποίηση στη βάση δεδομένων και η προβολή στο UI" είναι **μελλοντική επέκταση**.

Αυτό έρχεται σε αντίθεση με:
- το δικό σας διάγραμμα στο 3.4 (RabbitMQ → Backend consume/save Notification → MongoDB → Admin Dashboard polling) — που δείχνει ακριβώς αυτό το pipeline.
- ό,τι δοκιμάσαμε live σήμερα: πραγματικό `GET /api/notifications` + `PATCH /api/notifications/:id/read`, polling κάθε 7s από το `AlarmsNotificationsCard.js`, toast σε critical alarm, "Mark all read". Το είδατε live στο dashboard με πραγματικά "Low heating oil" alerts.

**Πρόταση διόρθωσης:** αλλάξτε τη διατύπωση σε "υλοποιήθηκε πλήρως" και περιγράψτε το πραγματικό pipeline (alarm → RabbitMQ → backend consumer → Notification στη Mongo → polling UI με toast). Βγάλτε το από τη λίστα μελλοντικών επεκτάσεων.

### 1.2 "Compensating Logic εκτός υλοποίησης" → ΛΑΘΟΣ, υπάρχει στον κώδικα

Στο τέλος του κεφαλαίου 7 (γραμμή ~370) γράφετε: *"Το μοτίβο Compensating Logic παραμένει ρητά εκτός της παρούσας υλοποίησης."*

Αυτό είναι λάθος — το `backend/controllers/expensesController.js` έχει πραγματικό compensating-logic block, με σχόλιο `PATTERN: COMPENSATING LOGIC` και:
```
console.warn('[createExpense] Compensated: rolled back MinIO object ${documentData} after save failure');
```
δηλαδή: αν αποτύχει το save στη Mongo μετά από επιτυχές upload στο MinIO, κάνει rollback (διαγραφή) του αντικειμένου στο MinIO. Αυτό καλύπτει ακριβώς το backlog item A8.

**Πρόταση διόρθωσης:** μεταφέρετε αυτή την παράγραφο από "out of scope" σε ενότητα υλοποιημένων patterns, με το απόσπασμα κώδικα ως παράδειγμα.

### 1.3 "Τα k6/SLA πειράματα δεν έχουν τρέξει ακόμα" → ΛΑΘΟΣ, υπάρχουν πλήρη αποτελέσματα

Στο κεφάλαιο 9 (γραμμές ~498, 581) και στην "Τελική Αποτίμηση" γράφετε ότι *"δεν διεξήχθησαν πλήρεις πειραματικές μετρήσεις"* και ότι *"Η πλήρης πειραματική αξιολόγηση αποτελεί το επόμενο βήμα"*· το ίδιο επαναλαμβάνεται στις "Μελλοντικές Επεκτάσεις" ("εκτέλεση των σχεδιασμένων k6 load tests").

Στην πραγματικότητα υπάρχει ήδη στο repo:
- `docs/evidence/sla/README.md` — πλήρης τεκμηρίωση μεθοδολογίας.
- 3× k6 baseline runs (login + CRUD, έως 60 VUs) — 15/9.
- 3× cold start runs σε Knative `min-scale 0` και 3× σε `min-scale 1` — 15-16/9.
- HPA load tests (30 & 100 παράλληλα logins) — 15/9.
- `docs/evidence/sla/2026-09-16-k6-percentiles.md` με πραγματικά p50/p95/p99 ανά endpoint.
- CDF plots (3 πραγματικά PNG).
- `docs/SLA-chapter9-draft.md` — μισό-γραμμένο κεφάλαιο 9 με μεθοδολογία SLI/SLO/SLA και πραγματικά νούμερα, ημερομηνίας 16/9.

Δηλαδή το S7/S8/S9 του roadmap είναι ολοκληρωμένα, με πραγματικά δεδομένα, όχι εκτιμήσεις.

**Πρόταση διόρθωσης:** αντικαταστήστε τα "future work" statements με τα πραγματικά αποτελέσματα. Ενδεικτικά, στο baseline (median των 3 runs):

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| GET /api/expenses | 61.4 ms | 253.0 ms | 541.8 ms |
| GET /api/apartments | 69.8 ms | 425.5 ms | 968.5 ms |
| GET /api/buildings | 68.5 ms | 385.8 ms | 898.1 ms |
| POST /api/login | 325.0 ms | 1.47 s | 2.26 s |

Cold start (πρώτο request μετά από idle):
- `min-scale: 0` → p50 2.63s, p95 2.81s, p99 2.84s
- `min-scale: 1` → p50 2.6ms, p95 4.6ms, p99 4.8ms (πρακτικά καθόλου cold start, όπως αναμενόταν)

Αυτά μπορούν να μπουν αυτούσια στο κεφάλαιο 9, αντλώντας από το `docs/SLA-chapter9-draft.md` που ήδη υπάρχει έτοιμο.

---

## 2. Παρατήρηση για τον Πίνακα 9 του report (SLA παραδείγματα)

Ο πίνακας με τα Gold/Silver/Bronze SLA thresholds (πίνακες 5-8) και το ενδεικτικό sample στον πίνακα 9 (π.χ. "POST /knative-extract cold start p95: 12s") μοιάζουν να είναι **θεωρητικές/εκτιμώμενες τιμές** που ορίστηκαν πριν τα πειράματα, όχι μετρημένες. Τα πραγματικά cold-start νούμερα που μετρήσατε (~2.6-2.9s σε min-scale 0) είναι καλύτερα από την εκτίμηση των 15s στο Bronze tier.

**Πρόταση:** κρατήστε τους πίνακες 5-8 ως "target SLA per tier" (είναι σωστό ότι είναι στόχοι), αλλά προσθέστε δίπλα μια στήλη ή έναν νέο πίνακα "Μετρημένο αποτέλεσμα" ώστε να φαίνεται ότι το tier που διαλέξατε (Silver/Bronze;) πληρούνται ή και ξεπερνιούνται. Αυτό δείχνει ότι δεν μείνατε στο θεωρητικό σχεδιασμό.

---

## 3. Μικρότερες προσθήκες που αξίζει να μπουν

### 3.1 Δύο νέα πραγματικά περιστατικά για το Κεφάλαιο 10 ("Λειτουργικά Προβλήματα & Επίλυση")

Το κεφάλαιο 10 ήδη έχει 8 πραγματικά περιστατικά (π.χ. Knative tag resolution, imagePullPolicy, Gemini model deprecation). Σήμερα παρουσιάστηκαν δύο ακόμα, στο ίδιο ύφος:

1. **Production crash από αφαίρεση "dead" dependency**: στο πλαίσιο καθαρισμού (A9), αφαιρέθηκε το `multer-s3` από το `backend/package.json` με βάση εσφαλμένη υπόθεση ότι δεν χρησιμοποιούνταν. Στην επόμενη Jenkins build, το `npm install` δεν το εγκατέστησε πια, το `require('multer-s3')` στο `server.js` έριξε exception στο startup, και το ΝΕΟ ReplicaSet μπήκε σε **CrashLoopBackOff** ενώ το παλιό ReplicaSet συνέχιζε να σερβίρει traffic (φαινόμενο που φάνηκε καθαρά στο ArgoCD UI: κόκκινη καρδιά, "0/1", ενώ η εφαρμογή έδειχνε ζωντανή γιατί το production traffic πήγαινε ακόμα στο υγιές pod). Λύση: επαναφορά του dependency. Καλό παράδειγμα για το πόσο επικίνδυνο είναι το "cleanup" χωρίς static-analysis επαλήθευση (π.χ. grep σε ολόκληρο το codebase πριν αφαιρεθεί οτιδήποτε).

2. **Jenkins changeset-detection false skip**: επαναλαμβανόμενο πρόβλημα όπου ένα μεμονωμένο commit δεν ενεργοποιεί τα `when { changeset ... }` conditionals σε Backend/Frontend stages του Jenkinsfile, με αποτέλεσμα το Stage View να δείχνει μόνο "Checkout SCM"/"Post Actions" και να νομίζει κανείς ότι το build πέρασε ενώ ουσιαστικά δεν έτρεξε τίποτα. Παράκαμψη: χειροκίνητο `FORCE_BUILD=true` parameter. Αξίζει να αναφερθεί ως known limitation/βελτίωση για μελλοντική δουλειά στο Jenkinsfile (π.χ. πιο robust changeset detection ή αφαίρεση του conditional).

### 3.2 GitHub URL στο τέλος του report

Το report καταλήγει με το link `https://github.com/AGLoCo13/Node-React.js-ExpensesApplication/tree/main`. Καλό θα ήταν να επιβεβαιώσετε ότι είναι το σωστό/τελικό repo (και ότι είναι public ή προσβάσιμο στον βαθμολογητή) πριν την παράδοση.

---

## 4. Τι ΔΕΝ χρειάζεται αλλαγή

- Τα €0,00 σε "Total Expenses"/"Pending Payments"/"This Month" στο live dashboard δεν είναι bug ούτε αντίφαση με το report — είναι σωστός υπολογισμός γιατί τα υπάρχοντα expense/payment records δεν έχουν ημερομηνία τρέχοντος μήνα.
- Οι υπόλοιπες ενότητες του report (2, 4-6, 8) φαίνονται συνεπείς με ό,τι επαληθεύσαμε σήμερα (architecture, resilience patterns πίνακας 1, metrics πίνακας 2).

---

## 5. Προτεινόμενη σειρά ενεργειών πριν την Δευτέρα

1. Διορθώστε τα 3 μεγάλα σημεία (§1) — είναι τα πιο εμφανή αν κάποιος διαβάσει το report δίπλα στο live demo.
2. Αντιγράψτε τα πραγματικά νούμερα από `docs/evidence/sla/2026-09-16-k6-percentiles.md` και `docs/SLA-chapter9-draft.md` στο κεφάλαιο 9 του report (υλικό ήδη έτοιμο, θέλει μόνο μεταφορά/μορφοποίηση).
3. Προσθέστε τα 2 νέα incidents στο κεφάλαιο 10.
4. Προαιρετικά: ένας μικρός πίνακας "target vs. measured" δίπλα στους πίνακες 5-8.
5. Επιβεβαιώστε το GitHub link.
