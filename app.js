import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, enableIndexedDbPersistence, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIG FIREBASE - METS LA TIENNE ICI
const firebaseConfig = {
  apiKey: "TA_API_KEY",
  authDomain: "unamdd-cloud.firebaseapp.com",
  projectId: "unamdd-cloud",
  storageBucket: "unamdd-cloud.appspot.com",
  messagingSenderId: "TON_ID",
  appId: "TON_APP_ID"
};

// 2. INITIALISATION
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. ACTIVER LE MODE OFFLINE - MAGIE FIREBASE
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.log("Erreur: plusieurs onglets ouverts");
    } else if (err.code == 'unimplemented') {
        console.log("Navigateur pas compatible");
    }
});

// 4. ENVOYER UN MESSAGE - Marche offline aussi
window.envoyer = async function(){
  let input = document.getElementById("TextBox1");
  let msg = input.value.trim();
  if(msg == "") return;
  
  try {
    await addDoc(collection(db, "chat_unamdd"), {
      message: msg,
      time: serverTimestamp()
    });
    input.value = ""; // Vide le champ
  } catch (e) {
    console.error("Erreur envoi: ", e);
  }
}

// 5. LIRE ET AFFICHER LES MESSAGES EN TEMPS RÉEL
const q = query(collection(db, "chat_unamdd"), orderBy("time", "asc"));

onSnapshot(q, (snapshot) => {
  let chatDiv = document.getElementById("Label1");
  let html = "";
  snapshot.forEach((doc) => {
    html += `<p style="margin:5px 0; padding:8px; background:#eee; border-radius:5px;">${doc.data().message}</p>`;
  });
  chatDiv.innerHTML = html;
  chatDiv.scrollTop = chatDiv.scrollHeight; // Scroll auto en bas
});

console.log("App UNAMDD prête - Mode Offline Activé");
