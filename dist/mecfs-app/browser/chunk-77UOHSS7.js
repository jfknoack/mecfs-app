import{a as G,b as P}from"./chunk-EZVFGS2F.js";import{a as N}from"./chunk-W34B4WUY.js";import{a as S,c as F}from"./chunk-FVQUQQMS.js";import{Aa as T,Ba as j,Ca as E,Da as L,Ea as z,Fa as B,ea as k}from"./chunk-YOABXWVE.js";import{$ as d,$b as m,Ab as c,Cb as _,Db as w,Lb as p,Nb as A,Ob as f,Pb as l,Ta as o,X as h,Z as y,Zb as I,ac as v,gb as s,hb as b,ib as u,sa as g,tb as M,ub as x,vb as C,yb as D,zb as i}from"./chunk-5DWJ2RKW.js";var K=["*"];var Z=[[["","mat-card-avatar",""],["","matCardAvatar",""]],[["mat-card-title"],["mat-card-subtitle"],["","mat-card-title",""],["","mat-card-subtitle",""],["","matCardTitle",""],["","matCardSubtitle",""]],"*"],J=["[mat-card-avatar], [matCardAvatar]",`mat-card-title, mat-card-subtitle,
      [mat-card-title], [mat-card-subtitle],
      [matCardTitle], [matCardSubtitle]`,"*"],Q=new y("MAT_CARD_CONFIG"),O=(()=>{class t{appearance;constructor(){let a=d(Q,{optional:!0});this.appearance=a?.appearance||"raised"}static \u0275fac=function(e){return new(e||t)};static \u0275cmp=s({type:t,selectors:[["mat-card"]],hostAttrs:[1,"mat-mdc-card","mdc-card"],hostVars:8,hostBindings:function(e,r){e&2&&I("mat-mdc-card-outlined",r.appearance==="outlined")("mdc-card--outlined",r.appearance==="outlined")("mat-mdc-card-filled",r.appearance==="filled")("mdc-card--filled",r.appearance==="filled")},inputs:{appearance:"appearance"},exportAs:["matCard"],ngContentSelectors:K,decls:1,vars:0,template:function(e,r){e&1&&(f(),l(0))},styles:[`.mat-mdc-card {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  position: relative;
  border-style: solid;
  border-width: 0;
  background-color: var(--mat-card-elevated-container-color, var(--mat-sys-surface-container-low));
  border-color: var(--mat-card-elevated-container-color, var(--mat-sys-surface-container-low));
  border-radius: var(--mat-card-elevated-container-shape, var(--mat-sys-corner-medium));
  box-shadow: var(--mat-card-elevated-container-elevation, var(--mat-sys-level1));
}
.mat-mdc-card::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: solid 1px transparent;
  content: "";
  display: block;
  pointer-events: none;
  box-sizing: border-box;
  border-radius: var(--mat-card-elevated-container-shape, var(--mat-sys-corner-medium));
}

.mat-mdc-card-outlined {
  background-color: var(--mat-card-outlined-container-color, var(--mat-sys-surface));
  border-radius: var(--mat-card-outlined-container-shape, var(--mat-sys-corner-medium));
  border-width: var(--mat-card-outlined-outline-width, 1px);
  border-color: var(--mat-card-outlined-outline-color, var(--mat-sys-outline-variant));
  box-shadow: var(--mat-card-outlined-container-elevation, var(--mat-sys-level0));
}
.mat-mdc-card-outlined::after {
  border: none;
}

.mat-mdc-card-filled {
  background-color: var(--mat-card-filled-container-color, var(--mat-sys-surface-container-highest));
  border-radius: var(--mat-card-filled-container-shape, var(--mat-sys-corner-medium));
  box-shadow: var(--mat-card-filled-container-elevation, var(--mat-sys-level0));
}

.mdc-card__media {
  position: relative;
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
}
.mdc-card__media::before {
  display: block;
  content: "";
}
.mdc-card__media:first-child {
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}
.mdc-card__media:last-child {
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}

.mat-mdc-card-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  box-sizing: border-box;
  min-height: 52px;
  padding: 8px;
}

.mat-mdc-card-title {
  font-family: var(--mat-card-title-text-font, var(--mat-sys-title-large-font));
  line-height: var(--mat-card-title-text-line-height, var(--mat-sys-title-large-line-height));
  font-size: var(--mat-card-title-text-size, var(--mat-sys-title-large-size));
  letter-spacing: var(--mat-card-title-text-tracking, var(--mat-sys-title-large-tracking));
  font-weight: var(--mat-card-title-text-weight, var(--mat-sys-title-large-weight));
}

.mat-mdc-card-subtitle {
  color: var(--mat-card-subtitle-text-color, var(--mat-sys-on-surface));
  font-family: var(--mat-card-subtitle-text-font, var(--mat-sys-title-medium-font));
  line-height: var(--mat-card-subtitle-text-line-height, var(--mat-sys-title-medium-line-height));
  font-size: var(--mat-card-subtitle-text-size, var(--mat-sys-title-medium-size));
  letter-spacing: var(--mat-card-subtitle-text-tracking, var(--mat-sys-title-medium-tracking));
  font-weight: var(--mat-card-subtitle-text-weight, var(--mat-sys-title-medium-weight));
}

.mat-mdc-card-title,
.mat-mdc-card-subtitle {
  display: block;
  margin: 0;
}
.mat-mdc-card-avatar ~ .mat-mdc-card-header-text .mat-mdc-card-title,
.mat-mdc-card-avatar ~ .mat-mdc-card-header-text .mat-mdc-card-subtitle {
  padding: 16px 16px 0;
}

.mat-mdc-card-header {
  display: flex;
  padding: 16px 16px 0;
}

.mat-mdc-card-content {
  display: block;
  padding: 0 16px;
}
.mat-mdc-card-content:first-child {
  padding-top: 16px;
}
.mat-mdc-card-content:last-child {
  padding-bottom: 16px;
}

.mat-mdc-card-title-group {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.mat-mdc-card-avatar {
  height: 40px;
  width: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-bottom: 16px;
  object-fit: cover;
}
.mat-mdc-card-avatar ~ .mat-mdc-card-header-text .mat-mdc-card-subtitle,
.mat-mdc-card-avatar ~ .mat-mdc-card-header-text .mat-mdc-card-title {
  line-height: normal;
}

.mat-mdc-card-sm-image {
  width: 80px;
  height: 80px;
}

.mat-mdc-card-md-image {
  width: 112px;
  height: 112px;
}

.mat-mdc-card-lg-image {
  width: 152px;
  height: 152px;
}

.mat-mdc-card-xl-image {
  width: 240px;
  height: 240px;
}

.mat-mdc-card-subtitle ~ .mat-mdc-card-title,
.mat-mdc-card-title ~ .mat-mdc-card-subtitle,
.mat-mdc-card-header .mat-mdc-card-header-text .mat-mdc-card-title,
.mat-mdc-card-header .mat-mdc-card-header-text .mat-mdc-card-subtitle,
.mat-mdc-card-title-group .mat-mdc-card-title,
.mat-mdc-card-title-group .mat-mdc-card-subtitle {
  padding-top: 0;
}

.mat-mdc-card-content > :last-child:not(.mat-mdc-card-footer) {
  margin-bottom: 0;
}

.mat-mdc-card-actions-align-end {
  justify-content: flex-end;
}
`],encapsulation:2,changeDetection:0})}return t})(),R=(()=>{class t{static \u0275fac=function(e){return new(e||t)};static \u0275dir=u({type:t,selectors:[["mat-card-title"],["","mat-card-title",""],["","matCardTitle",""]],hostAttrs:[1,"mat-mdc-card-title"]})}return t})();var H=(()=>{class t{static \u0275fac=function(e){return new(e||t)};static \u0275dir=u({type:t,selectors:[["mat-card-content"]],hostAttrs:[1,"mat-mdc-card-content"]})}return t})(),U=(()=>{class t{static \u0275fac=function(e){return new(e||t)};static \u0275dir=u({type:t,selectors:[["mat-card-subtitle"],["","mat-card-subtitle",""],["","matCardSubtitle",""]],hostAttrs:[1,"mat-mdc-card-subtitle"]})}return t})();var V=(()=>{class t{static \u0275fac=function(e){return new(e||t)};static \u0275cmp=s({type:t,selectors:[["mat-card-header"]],hostAttrs:[1,"mat-mdc-card-header"],ngContentSelectors:J,decls:4,vars:0,consts:[[1,"mat-mdc-card-header-text"]],template:function(e,r){e&1&&(f(Z),l(0),_(1,"div",0),l(2,1),w(),l(3,2))},encapsulation:2,changeDetection:0})}return t})();var X=(()=>{class t{static \u0275fac=function(e){return new(e||t)};static \u0275mod=b({type:t});static \u0275inj=h({imports:[k]})}return t})();function $(t,n){if(t&1&&(i(0,"p",4),m(1),c()),t&2){let a=A();o(),v(a.error())}}var q=class t{auth=d(E);route=d(S);router=d(F);theme=d(N);error=g(null);busy=g(!1);async login(){this.error.set(null),this.busy.set(!0);try{await this.auth.loginWithGoogle();let n=this.route.snapshot.queryParamMap.get("returnUrl");await this.router.navigateByUrl(n?.startsWith("/")?n:"/dashboard")}catch(n){this.error.set(tt(n))}finally{this.busy.set(!1)}}static \u0275fac=function(a){return new(a||t)};static \u0275cmp=s({type:t,selectors:[["app-login"]],decls:15,vars:4,consts:[[1,"login"],["matIconButton","","type","button",1,"login__theme-toggle",3,"click"],[1,"login__card"],[1,"login__actions"],[1,"login__error"],["matButton","filled","type","button",3,"click","disabled"]],template:function(a,e){a&1&&(i(0,"section",0)(1,"button",1),p("click",function(){return e.theme.toggle()}),i(2,"mat-icon"),m(3),c()(),i(4,"mat-card",2)(5,"mat-card-header")(6,"mat-card-title"),m(7,"Login"),c(),i(8,"mat-card-subtitle"),m(9,"Anmeldung mit Google. Nur freigeschaltete Accounts."),c()(),i(10,"mat-card-content")(11,"div",3),x(12,$,2,1,"p",4),i(13,"button",5),p("click",function(){return e.login()}),m(14," Mit Google anmelden "),c()()()()()),a&2&&(o(),M("aria-label",e.theme.mode()==="dark"?"Hellmodus":"Dunkelmodus"),o(2),v(e.theme.mode()==="dark"?"light_mode":"dark_mode"),o(9),C(e.error()?12:-1),o(),D("disabled",e.busy()))},dependencies:[X,O,H,V,U,R,B,z,L,P,G],styles:["[_nghost-%COMP%]{display:block;height:100%}.login[_ngcontent-%COMP%]{position:relative;display:flex;min-height:100%;align-items:center;justify-content:center;padding:24px}.login__theme-toggle[_ngcontent-%COMP%]{position:absolute;top:16px;right:16px}.login__card[_ngcontent-%COMP%]{width:min(100%,420px)}.login__actions[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:8px;margin-top:16px}.login__error[_ngcontent-%COMP%]{margin:0 0 8px;color:var(--mat-sys-error)}"]})};function tt(t){if(t instanceof T||t instanceof j)return t.message;let n=typeof t=="object"&&t!==null&&"code"in t?String(t.code):"";return n==="auth/popup-closed-by-user"||n==="auth/cancelled-popup-request"?"Google-Login wurde abgebrochen.":n==="auth/operation-not-allowed"?"Google-Anmeldung ist in Firebase noch nicht aktiviert.":n==="auth/unauthorized-domain"?"Diese Domain ist in Firebase nicht f\xFCr Google-Login zugelassen.":n==="permission-denied"?"Kein Zugriff. Der Account ist nicht freigeschaltet oder die Regeln sind noch nicht ver\xF6ffentlicht.":n==="auth/invalid-api-key"||n==="auth/configuration-not-found"?"Firebase ist noch nicht vollst\xE4ndig eingerichtet.":t instanceof Error&&t.message?t.message:"Google-Login fehlgeschlagen."}export{q as Login};
