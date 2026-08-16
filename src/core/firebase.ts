import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCMbHtH0xIFYerC6Pq53w6X3zlS8U75vsg",
    authDomain: "coup-49ffc.firebaseapp.com",
    databaseURL: "https://coup-49ffc-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "coup-49ffc",
    storageBucket: "coup-49ffc.firebasestorage.app",
    messagingSenderId: "240544954960",
    appId: "1:240544954960:web:c7dc66b69092af69892f55",
    measurementId: "G-DSQVNZPY8G"
};

// เริ่มการทำงานของ Firebase
const app = initializeApp(firebaseConfig);

// ส่งออก (Export) db เพื่อให้ Component อื่นๆ เรียกใช้งานได้
export const db = getFirestore(app);
