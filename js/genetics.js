// Horse coat color genetics: phenotype, inheritance and foal odds.
import { pick } from './util.js';

/* =========================================================
   GENETICS (simplified real horse color genes)
   Each gene = two copies; 0 = plain copy, 1 = the special one.
   ========================================================= */
export const GENES = ['E','A','Cr','D','G','TO','LP'];
export const ALLELES = {E:['e','E'],A:['a','A'],Cr:['n','Cr'],D:['nd','D'],G:['g','G'],TO:['n','TO'],LP:['n','LP']};
export const GENE_NAME = {E:'Black base',A:'Bay',Cr:'Cream',D:'Dun',G:'Gray',TO:'Pinto',LP:'Appaloosa'};
export const MARKET_FREQ = {E:.5,A:.55,Cr:.12,D:.1,G:.07,TO:.07,LP:.06};
export const has = a => a[0]===1 || a[1]===1;
export const cnt = a => a[0] + a[1];

export function phen(g){
  let color;
  if (has(g.G)) color = 'Gray';
  else {
    const base = has(g.E) ? (has(g.A) ? 'Bay' : 'Black') : 'Chestnut';
    const cr = cnt(g.Cr), dun = has(g.D);
    if (cr === 2) color = {Chestnut:'Cremello', Bay:'Perlino', Black:'Smoky Cream'}[base];
    else if (cr === 1) color = dun ? {Chestnut:'Dunalino', Bay:'Dunskin', Black:'Smoky Grulla'}[base]
                                   : {Chestnut:'Palomino', Bay:'Buckskin', Black:'Smoky Black'}[base];
    else color = dun ? {Chestnut:'Red Dun', Bay:'Bay Dun', Black:'Grulla'}[base] : base;
  }
  return {color, pinto: has(g.TO), appy: has(g.LP)};
}
export const fullName = p => p.color + (p.pinto ? ' Pinto' : '') + (p.appy ? ' Appaloosa' : '');
export function randomGenes(){
  const g = {};
  for (const k of GENES) g[k] = [Math.random()<MARKET_FREQ[k]?1:0, Math.random()<MARKET_FREQ[k]?1:0];
  return g;
}
export function inherit(m, s){
  const g = {};
  for (const k of GENES) g[k] = [pick(m.genes[k]), pick(s.genes[k])];
  return g;
}
export function odds(m, s){
  const res = {};
  const per = GENES.map(k => { const o=[]; for (const x of m.genes[k]) for (const y of s.genes[k]) o.push([x,y]); return o; });
  const g = {};
  (function rec(i, p){
    if (i === GENES.length){
      const ph = phen(g), n = fullName(ph);
      if (!res[n]) res[n] = {p:0, ph};
      res[n].p += p; return;
    }
    for (const o of per[i]){ g[GENES[i]] = o; rec(i+1, p/4); }
  })(0, 1);
  return Object.entries(res).sort((a,b) => b[1].p - a[1].p);
}

