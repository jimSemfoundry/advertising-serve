const { initializeApp } = require('firebase/app');
const { initializeFirestore } = require( 'firebase/firestore')

const firebaseConfig =  {
        apiKey: "AIzaSyASOhnQDR56cw3F8W8CCyigPiTPYZpB260",
        authDomain: "advertising-85cfc.firebaseapp.com",
        projectId: "advertising-85cfc",
        storageBucket: "advertising-85cfc.appspot.com",
        messagingSenderId: "669975544992",
        appId: "1:669975544992:web:390a663b987ba059d2b5c5",
}


const app = initializeApp(firebaseConfig);
const firebase = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

module.exports = firebase