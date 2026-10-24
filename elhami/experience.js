(()=>{
 document.addEventListener('click',e=>{
  if(window.elhamiAccess?.authenticated)return;
  const target=e.target.closest('main button,[data-auth-required]');
  if(!target||target.hasAttribute('data-public'))return;
  e.preventDefault();e.stopImmediatePropagation();window.elhamiAccess.prompt('signup');
 },true);
 document.querySelector('header>a').addEventListener('click',e=>{e.preventDefault();if(window.elhamiAccess.authenticated)page('home');else window.elhamiAccess.prompt('login');});
})();
