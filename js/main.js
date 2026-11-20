// Starts the game.
import { horseImg } from './sprites.js';
import { randomGenes } from './genetics.js';
import { look, newGame, setState, state } from './state.js';
import { showModal, toast } from './ui.js';
import { render } from './views.js';
import { initControls } from './controls.js';
import { load, tick } from './game.js';
import './sprite-data.js';
import './util.js';
import './data.js';
import './affinity.js';
import './farmhand.js';
import './shop.js';
import './actions.js';
import './world.js';
import './village.js';
import './market-map.js';
import './breeding.js';
import './world-draw.js';
import './riding.js';

initControls();
setState(load());
if (!state) newGame();
tick();
render();
if (state.intro) showModal(`<div class="mpic">${horseImg(look(state.horses[0]||{genes:randomGenes()}),6,'bob')}</div>
  <h2>Welcome to Clover Hill Stables!</h2>
  <p>🚪 Walk out of the barn to your fields, then explore!<br>🌾 Plant hay, oats and carrots, and harvest them when they've grown.<br>🌳 Give every horse some time in the paddock (→) each day.<br>🏘️ South of the fields is the village: the 🏷️ Market Hall, the 💞 Heart Barn and the 🏇 riding arena.<br>📖 The Horse Book is on a stand in your barn.</p>
  <p><b>Tip:</b> You have a love potion 🧪! Lead Daisy and Sunny to the Heart Barn, put them in the pens, and use it at the love table.</p>
  <button class="primary" data-act="start">Let's go!</button>`);
if (state.handRefund){ delete state.handRefund; toast('👩‍🌾 The stable hand has left, so you take the horses out yourself now. You got your 500 🪙 back!', 'gold'); }
setInterval(tick, 1000);
