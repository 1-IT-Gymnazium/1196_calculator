// Třída CalculatorEngine – zajišťuje výpočty, historii a paměť kalkulačky
class CalculatorEngine {
  constructor() {
    this.memory = 0;        // Hodnota v paměti kalkulačky
    this.history = [];      // Historie výpočtů
  }

  // Vypočítá výraz s uložením do historie
  evaluate(raw) {
    if (!raw || raw.trim() === '') throw new Error('Nebyl zadán žádný vstup.');

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
      .replace(/\bsin\(/g, 'math.sin(')                   // sin ve stupních
      .replace(/\bcos\(/g, 'math.cos(')                   // cos ve stupních
      .replace(/\btan\(/g, 'math.tan(');                  // tan ve stupních

    // Faktoriál 1) část - funkce gamma (Lanczos, 9 členů)
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

    // Faktoriál 2) část - kladné n
    const factorial = n => {
      if (!isFinite(n)) throw new Error('Neplatný vstup');
      if (Number.isInteger(n)) {
        if (n < 0) throw new Error('Faktoriál záporného celého čísla není definován 0');
        // přesný celočíselný výpočet do 170!, pak už přeteče JS float
        if (n <= 170) {
          let r = 1;
          for (let i = 2; i <= n; i++) r *= i;
          return r;
        }
        // Větší hodnoty - Gamma
      } else if (n < 0 && Math.floor(n) === n) {
        /* záporný celý ⇒ pól Γ, chyba */
        throw new Error('Faktoriál záporného celého čísla není definován 1');
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
        const cos = Math.cos(x * Math.PI / 180);
        if (Math.abs(cos) < 1e-10) throw new Error('Při výpočetu tangensu došlo k chybě, kosínus je velmi blízko nule.');
        return Math.tan(x * Math.PI / 180);
      }
    };

    // Bezpečné vyhodnocení výrazu
    try {
      const res = Function('math', 'factorial', 'return(' + expr + ')')(math, factorial);
      
      // Ne-konečné hodnoty
      if (!Number.isFinite(res)) {
        if (res ===  Infinity || res === -Infinity) {
          throw new Error('Nulou nelze dělit.');
        }
        throw new Error('Neplatný výraz.'); // NaN
      }

      return res;
    } catch(err) {
      throw new Error(err.message || err);
    }
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

  const pressedMap = new Map(); // Mapa stisknutých kláves
  let lastEq = false; // Je číslo v textovém poli výsledek?
  let errorMode = false; // Je výsledek chyba?

  // Zobrazení chybu v textovém poli.
  function onError(err) {
    input.value = err.message || err;
    errorMode = true;
    lastEq = false;
    prev.textContent = '';
    input.classList.add('error');
  }

  // Smaže chybovou zprávu při stisknutí klávesy
  function clearError () {
    input.classList.remove('error');
    input.value = '';
    errorMode = false;
  }

  // Automatické přizpůsobení výšky vstupu
  const auto = () => {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  };

  // Zobrazení předběžného výsledku
  const showPrev = () => {
    try {
      prev.textContent = '→ ' + eng.evaluate(input.value);
    } catch {
      prev.textContent = '';
    }
  };

  // History refresh
  const refreshHist = () => {
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
    if (errorMode) clearError();

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
            const vysledek = eng.evaluate(input.value); // Vypočítá výsledek
            eng.history.unshift(input.value + ' = ' + vysledek); // Přidá výraz na začátek historie
            if (eng.history.length > 10) eng.history.pop(); // Udržuje max. 10 záznamů
            input.value = vysledek.toString(); // Zobrazí výsledek
            lastEq = true;
            refreshHist();
            prev.textContent = '';
          } catch (err) {
            onError(err);
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
    errorMode = false
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
  
  // Detekce stisknutí klávesy
  document.addEventListener('keydown', e => {
    if (errorMode) clearError();
    if (lastEq && /^[0-9.]$/.test(e.key)) {
      input.value = '';
      lastEq = false;
    }

    // Vizualizace digitální klávesy při stisku fyzické klávesy
    const btn = document.querySelector(`
      .calculator button[data-key="${e.key}"],
      .calculator button[data-key-alt="${e.key}"]`
    );

    if (btn && !pressedMap.has(e.code)) {
      btn.classList.add('pressed');
      pressedMap.set(e.code, btn);
    }

    // Akce při stisknutí kláves, které nezadávají text
    if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      document.querySelector('[data-action="equals"]').click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      document.querySelector('[data-action="clear-all"]').click();
    }
  });

  // Detekce puštění klávesy pro vizualizaci na digitální klávesnici
  document.addEventListener('keyup', e => {
    const btn = pressedMap.get(e.code);
    if (btn) {
      btn.classList.remove('pressed');
      pressedMap.delete(e.code);
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