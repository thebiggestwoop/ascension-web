function f(t,e=0){var a;const c=(a=t.attack.effects)!=null&&a.length?` ${t.attack.effects.join(", ")}`:"";return`${t.attack.damageCD+e}[CD]${c}`}export{f as a};
