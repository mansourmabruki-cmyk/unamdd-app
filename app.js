import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDummy-RemplaceParTaVraieCle",
  authDomain: "unamdd-cloud.firebaseapp.com",
  projectId: "unamdd-cloud",
  storageBucket: "unamdd-cloud.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(()=>{});

window.saveData = async (nom, montant) => {
  if(!nom || !montant){ alert("Remplis Nom et Montant"); return; }
  await addDoc(collection(db, "transactions"), {
    nom: nom,
    montant: Number(montant),
    date: new Date()
  });
  alert("✅ Enregistré sur téléphone !");
  document.getElementById('nom').value = "";
  document.getElementById('montant').value = "";
};

onSnapshot(collection(db, "transactions"), (snapshot) => {
  let html = "";
  snapshot.forEach((doc) => {
    let data = doc.data();
    html += <tr><td>${data.nom}</td><td>${data.montant}</td><td>${data.date.toDate().toLocaleString()}</td></tr>;
  });
  const tbody = document.getElementById('table-body');
  if(tbody) tbody.innerHTML = html;
});
