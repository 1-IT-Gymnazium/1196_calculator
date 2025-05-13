// Třída CalculatorEngine – zajišťuje výpočty, historii a paměť kalkulačky
class CalculatorEngine {
  constructor() {
    this.memory = 0;        // Hodnota v paměti kalkulačky
    this.history = [];      // Historie výpočtů
  }
  
  // Vypočítá výraz bez uložení do historie
  compute(raw) {
    return this.eval(raw); 
  }

  // Vypočítá výraz s uložením do historie
  evaluate(raw) {
    const r = this.eval(raw);
    this._addHistory(raw + ' = ' + r);
    return r;
  }

  eval(raw) {
    if (!raw || raw.trim() === '') throw new Error('Chybný výraz kód 1');

    let expr = raw;

    // Nahradí √číslo nebo √(výraz) funkcí math.sqrt
    const sqrtRegex = /√\s*(\d+(?:\.\d+)?|\([^()]*\))/g;
    while (sqrtRegex.test(expr)) {
      expr = expr.replace(sqrtRegex, 'math.sqrt($1)');
    }

    // Implicitní násobení – např. 2(3), nebo 2sin(30)
    expr = expr.replace(/(\d|\))(?=(?:math\.sqrt|math\.log10|math\.sin|math\.cos|math\.tan|\())/g, '$1*');
    expr = expr.replace(/(\))(?=\d)/g, '$1*'); // Implicitní násobení za závorkou

    // Nahrazení operátorů a funkcí
    expr = expr
      .replace(/\^/g, '**')                               // mocnina
      .replace(/(-?\d+(?:\.\d+)?)!/g, 'factorial($1)')    // faktoriál
      .replace(/\blog\(/g, 'math.log10(')                 // přirozený logaritmus
      .replace(/\bsin\(/g, 'math.sin(')                   // sin
      .replace(/\bcos\(/g, 'math.cos(')                   // cos
      .replace(/\btan\(/g, 'math.tan(');                  // tan

    // Lokální implementace faktoriálu
    /* ---- 1) funkce gamma (Lanczos, 9 členů) ---- */
    const gamma = z => {
      const g = 7;
      const p = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7
      ];

      if (z < 0.5) {
        /* reflektivní formule Γ(z) Γ(1-z) = π / sin(πz) */
        return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
      }

      z -= 1;
      let x = p[0];
      for (let i = 1; i < p.length; i++) x += p[i] / (z + i);

      const t = z + g + 0.5;
      return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
    };

    /* ---- 2) faktoriál pro libovolné kladné n ---- */
    const factorial = n => {
      if (!isFinite(n)) throw new Error('Neplatný vstup');
      if (Number.isInteger(n)) {
        if (n < 0) throw new Error('Faktoriál záporného celého čísla není definován');
        /* přesný celočíselný výpočet do 170!, pak už přeteče JS float */
        if (n <= 170) {
          let r = 1;
          for (let i = 2; i <= n; i++) r *= i;
          return r;
        }
        /* pro větší hodnoty použij Gamma */
      } else if (n < 0 && Math.floor(n) === n) {
        /* záporný celý ⇒ pól Γ, chyba */
        throw new Error('Faktoriál záporného celého čísla není definován');
      }
      /* obecný případ: Γ(n+1) */
      return gamma(n + 1);
    };
      
  
    // Vlastní "math" objekt s upravenými trigonometrickými funkcemi (ve stupních)
    const math = {
      ...Math,
      sqrt: x => Math.sqrt(x),
      log10: x => Math.log10(x),
      sin: x => Math.sin(x * Math.PI / 180),
      cos: x => Math.cos(x * Math.PI / 180),
      tan: x => {
        const c = Math.cos(x * Math.PI / 180);
        if (Math.abs(c) < 1e-10) throw new Error('Chybný výraz kód 3');
        return Math.tan(x * Math.PI / 180);
      }
    };
    

    // Bezpečné vyhodnocení výrazu
    try {
      const res = Function('math', 'factorial', 'return(' + expr + ')')(math, factorial);
      if (!isFinite(res)) throw 0;
      return res;
    } catch(err) {
      throw new Error('Chybný výraz code 4');
    }
  }
  
  _addHistory(e) {
    this.history.unshift(e);        // Přidá výraz na začátek historie
    if (this.history.length > 10) this.history.pop(); // Udržuje max. 10 záznamů
  }
  
  // Funkce pro práci s pamětí kalkulačky
  memoryAdd(v) { this.memory += v; }
  memoryMinus(v) { this.memory -= v; }
  memoryRecall() { return this.memory; }
  memoryClear() { this.memory = 0; }
}
  
// Pomocná funkce pro vložení textu na pozici kurzoru v textovém poli
function insertAtCursor(el, txt) {
    const s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.slice(0, s) + txt + el.value.slice(e);
    el.selectionStart = el.selectionEnd = s + txt.length;
}
  
// Inicializace kalkulačky – obsluhuje UI a propojení s enginem
export function initCalculator() {
  const eng = new CalculatorEngine();
  const input = document.getElementById('current');
  const prev = document.getElementById('preview');
  const hist = document.getElementById('history');
  let lastEq = false;

  const auto = () => { // Automatické přizpůsobení výšky vstupu
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  };

  const showPrev = () => { // Zobrazí předběžný výsledek
    try {
      prev.textContent = '→ ' + eng.compute(input.value);
    } catch {
      prev.textContent = '';
    }
  };

  const refreshHist = () => { // Obnoví seznam historie
    hist.innerHTML = '';
    eng.history.forEach(h => {
      const li = document.createElement('li');
      li.textContent = h;
      hist.append(li);
    });
  };

  // Obsluha kliknutí na tlačítka
  document.querySelector('.calculator').addEventListener('click', e => {
    if (!e.target.matches('button')) return;

    const act = e.target.dataset.action;
    const val = e.target.textContent;

    if (act === 'copy') {
      navigator.clipboard.writeText(input.value); // Kopíruje text
      return;
    }

    if (act === 'delete') {
      const p = input.selectionStart;
      if (p > 0) {
        input.value = input.value.slice(0, p - 1) + input.value.slice(p);
        input.selectionStart = input.selectionEnd = p - 1;
      }
    } else if (!['equals', 'clear-all', 'memory-add', 'memory-minus', 'memory-recall', 'memory-clear'].includes(act)) {
      let t = val;
      if (act === 'function') t = val + '(';
      if (act === 'factorial') t = '!';
      insertAtCursor(input, t);
      lastEq = false;
    } else {
      // Speciální akce (výpočet, paměť, mazání)
      switch (act) {
        case 'equals':
          try {
            input.value = eng.evaluate(input.value).toString();
            lastEq = true;
            refreshHist();
            prev.textContent = '';
          } catch (err) {
            alert(err.message);
          }
          break;
        case 'clear-all':
          input.value = '';
          prev.textContent = '';
          break;
        case 'memory-add':
          eng.memoryAdd(Number(input.value) || 0);
          break;
        case 'memory-minus':
          eng.memoryMinus(Number(input.value) || 0);
          break;
        case 'memory-recall':
          input.value = eng.memoryRecall().toString();
          lastEq = false;
          break;
        case 'memory-clear':
          eng.memoryClear();
          break;
      }
    }

    auto(); showPrev(); input.focus();
  });

  // Kliknutí na položku historie a vložení jej do vstupu
  hist.addEventListener('click', e => {
    if (e.target.tagName === 'LI') {
      input.value = e.target.textContent.split('=')[0].trim();
      lastEq = false;
      auto(); showPrev(); input.focus();
    }
  });

  // Reakce na změny ve vstupním poli
  input.addEventListener('input', () => {
    auto();
    lastEq = false;
    showPrev();
  });
  // Zkopírování výsledku do schránky při kliknutí na výsledek
  input.addEventListener('click', () => {
      if (lastEq && input.value.trim() !== '') {
        navigator.clipboard.writeText(input.value).then(() => {
          // Volitelně: vizuální potvrzení, např. změna rámečku
          input.style.borderColor = 'lime';
          setTimeout(() => input.style.borderColor = '', 300);
        });
      }
  });

  // Klávesové zkratky pro enter a escape
  input.addEventListener('keydown', e => {
    if (lastEq && /^[0-9.]$/.test(e.key)) {
      input.value = '';
      lastEq = false;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      document.querySelector('[data-action="equals"]').click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      document.querySelector('[data-action="clear-all"]').click();
    }
  });

  // Přepínač světlého/tmavého režimu
  const tgl = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  tgl.checked = saved === 'dark';
  tgl.addEventListener('change', () => {
    const th = tgl.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', th);
    localStorage.setItem('theme', th);
  });

  // Inicializace při spuštění
  auto(); showPrev(); refreshHist(); input.focus();
}
  
// Spuštění kalkulačky po načtení stránky
document.addEventListener('DOMContentLoaded', () => initCalculator());