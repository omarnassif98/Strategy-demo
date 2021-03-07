if (!firebase.apps.length){
  console.log('INITIALIZED');
  let firebaseConfig = {
  apiKey: "AIzaSyCXy7CIQMnGYRzcdki5rYSC6VPkxf6guoY",
  authDomain: "deception-616b8.firebaseapp.com",
  databaseURL: "https://deception-616b8-default-rtdb.firebaseio.com",
  projectId: "deception-616b8",
  storageBucket: "deception-616b8.appspot.com",
  messagingSenderId: "267786241467",
  appId: "1:267786241467:web:5c2164b96a00718b08309e"
};
  firebase.initializeApp(firebaseConfig);
}
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
var database = firebase.database();