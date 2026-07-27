let ctx=null;
export function initAudio(){if(ctx)return;try{ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}
export function playSound(t){
  if(!ctx)return;
  try{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    const n=ctx.currentTime;
    switch(t){
      case"attack":o.type="square";o.frequency.setValueAtTime(440,n);o.frequency.exponentialRampToValueAtTime(220,n+0.1);g.gain.setValueAtTime(0.12,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.1);o.start(n);o.stop(n+0.1);break;
      case"crit":o.type="sawtooth";o.frequency.setValueAtTime(880,n);o.frequency.exponentialRampToValueAtTime(1760,n+0.15);g.gain.setValueAtTime(0.18,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.2);o.start(n);o.stop(n+0.2);break;
      case"skill":o.type="sine";o.frequency.setValueAtTime(330,n);o.frequency.linearRampToValueAtTime(660,n+0.2);g.gain.setValueAtTime(0.12,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.25);o.start(n);o.stop(n+0.25);break;
      case"hit":o.type="triangle";o.frequency.setValueAtTime(150,n);o.frequency.exponentialRampToValueAtTime(80,n+0.2);g.gain.setValueAtTime(0.18,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.2);o.start(n);o.stop(n+0.2);break;
      case"win":o.type="sine";[523,659,784,1047].forEach((f,i)=>{o.frequency.setValueAtTime(f,n+i*0.12);});g.gain.setValueAtTime(0.12,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.5);o.start(n);o.stop(n+0.5);break;
      case"lose":o.type="triangle";[400,350,300,200].forEach((f,i)=>{o.frequency.setValueAtTime(f,n+i*0.15);});g.gain.setValueAtTime(0.15,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.6);o.start(n);o.stop(n+0.6);break;
      case"equip":o.type="sine";o.frequency.setValueAtTime(1200,n);o.frequency.exponentialRampToValueAtTime(1800,n+0.1);g.gain.setValueAtTime(0.08,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.15);o.start(n);o.stop(n+0.15);break;
      case"heal":o.type="sine";o.frequency.setValueAtTime(600,n);o.frequency.exponentialRampToValueAtTime(900,n+0.2);g.gain.setValueAtTime(0.1,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.3);o.start(n);o.stop(n+0.3);break;
      case"potion":o.type="sine";o.frequency.setValueAtTime(800,n);o.frequency.exponentialRampToValueAtTime(1200,n+0.15);g.gain.setValueAtTime(0.1,n);g.gain.exponentialRampToValueAtTime(0.01,n+0.2);o.start(n);o.stop(n+0.2);break;
    }
  }catch(e){}
}