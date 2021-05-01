var currentActiveDropdown = null;
var uiConfig = {
  callbacks:{signInSuccessWithAuthResult: function(authResult) {
    console.log(authResult);
    
    return false;
  }
},
    signInOptions: [
      {
          provider:firebase.auth.EmailAuthProvider.PROVIDER_ID,
          requireDisplayName:false
      },
      firebase.auth.GoogleAuthProvider.PROVIDER_ID
    ],
    signInFlow: 'popup',
    tosUrl: '<your-tos-url>',
    privacyPolicyUrl: function() {
      window.location.assign('<your-privacy-policy-url>');
    }
  };
var ui = new firebaseui.auth.AuthUI(firebase.auth());
ui.start('#firebaseui-auth-container', uiConfig);
document.addEventListener('click', function(event){
  let clickObj = event.target;
  while(clickObj.parentElement){
    if (clickObj.className == "navbar"){
      console.log(clickObj);
      return;
    }
    clickObj = clickObj.parentElement;
  }
  ClearDropdown();
});

firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        if(user.displayName){
            sessionStorage.setItem('userName', user.displayName);
            AddProfileDropdown();
            var loginEvent = new Event('authComplete');
            document.dispatchEvent(loginEvent);
        }else{
          document.getElementById('loginWindow').style.display =  'block';
          document.getElementById('firebaseui-auth-container').style.display = 'none';
          document.getElementById('profileSetup').style.display = 'block';
        }
    }else{
      var noAuth = new Event('noAuth');
      document.dispatchEvent(noAuth);
    }
  }
);
function RevealDropdown(dropdown){
  console.log(dropdown);
    if(currentActiveDropdown){
        currentActiveDropdown.style.display = 'none';
    }
    currentActiveDropdown = dropdown.getElementsByClassName('dropdownContent')[0];
    currentActiveDropdown.style.display = 'block';
}

function ClearDropdown(){
  if(currentActiveDropdown){
    currentActiveDropdown.style.display = 'none';
  }
  currentActiveDropdown = null;
}

function AddProfileDropdown(){
    document.getElementById('loginDropdown').style.display = 'none';
    document.getElementById('profileDropdown').style.display = 'block';
    document.getElementById('profileDisplayName').innerHTML = firebase.auth().currentUser.displayName;
}

function UpdateInputProperty(element){
  console.log(element.value);
  let accompanyingButton = element.parentElement.getElementsByTagName('button')[0];
  accompanyingButton.disabled = (element.value.length == 0);
}

function SubmitProfile(wrapper){
    firebase.auth().currentUser.updateProfile({displayName:document.getElementById('usernameEntry').value}).then(function(){
      wrapper.style.display = 'none';
      AddProfileDropdown();
    });
}