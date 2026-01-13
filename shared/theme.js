(function(){
  var key = "financeTheme";
  var root = document.documentElement;
  function getTheme(){
    try{
      return localStorage.getItem(key) || "dark";
    }catch(e){
      return "dark";
    }
  }
  function setTheme(theme){
    root.setAttribute("data-theme", theme);
    try{ localStorage.setItem(key, theme); }catch(e){}
    var btn = document.querySelector("[data-theme-toggle]");
    if (btn){
      btn.textContent = theme === "light" ? "Dark mode" : "Light mode";
    }
  }
  setTheme(getTheme());
  var toggle = document.querySelector("[data-theme-toggle]");
  if (toggle){
    toggle.addEventListener("click", function(){
      var current = root.getAttribute("data-theme") || "dark";
      setTheme(current === "light" ? "dark" : "light");
    });
  }
})();
