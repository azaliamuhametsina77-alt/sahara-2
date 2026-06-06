(function () {
  const currentScript = document.currentScript;
  const baseUrl = new URL('.', currentScript.src).href;
  const mount = document.getElementById('africa-map-loader') || document.getElementById('africa-scroll-nav');

  function showError(message) {
    if (!mount) return;
    mount.innerHTML = '<div style="font-family:Montserrat,Arial,sans-serif;padding:24px;border:1px solid #d99696;color:#212121;background:rgba(217,150,150,.12);border-radius:14px;">Карта не загрузилась: ' + message + '</div>';
  }

  if (!mount) {
    console.warn('[Africa map] Не найден контейнер #africa-map-loader или #africa-scroll-nav');
    return;
  }

  // CSS подключается автоматически, чтобы в Tilda было меньше мест для ошибки.
  if (!document.querySelector('link[data-africa-map-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = baseUrl + 'africa-map.css?v=' + Date.now();
    link.setAttribute('data-africa-map-css', '1');
    document.head.appendChild(link);
  }

  fetch(baseUrl + 'africa-map.html?v=' + Date.now(), { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('не удалось загрузить africa-map.html, статус ' + response.status);
      return response.text();
    })
    .then(html => {
      mount.innerHTML = html;
      initAfricaScrollMap();
    })
    .catch(error => {
      console.error('[Africa map]', error);
      showError(error.message || String(error));
    });

  function initAfricaScrollMap() {
  const root = document.getElementById('africa-scroll-nav');
  if (!root) {
    showError('в africa-map.html не найден #africa-scroll-nav');
    return;
  }

  const isMobile = () => window.innerWidth <= 980;

  // ---------- Десктопная логика (ваш исходный код без изменений) ----------
  if (!isMobile()) {
    const selectedText = root.querySelector('.af-scroll-map__default-text .af-scroll-map__selected');

    function setStage(stage) {
      root.classList.toggle('is-ssa', stage === 1);
      root.classList.toggle('is-project', stage === 2);
    }

    function updateStageByScroll() {
      const rect = root.getBoundingClientRect();
      const scrollable = Math.max(1, root.offsetHeight - window.innerHeight);
      const passed = Math.min(Math.max(-rect.top, 0), scrollable);
      const progress = passed / scrollable;

      if (progress < 0.30) setStage(0);
      else if (progress < 0.62) setStage(1);
      else setStage(2);
    }

    updateStageByScroll();
    window.addEventListener('scroll', updateStageByScroll, { passive: true });
    window.addEventListener('resize', updateStageByScroll);

    function findTarget(selector) {
      if (!selector) return null;
      const id = selector.charAt(0) === '#' ? selector.slice(1) : selector;
      return document.getElementById(id) || document.querySelector(selector);
    }

    function scrollToTarget(selector) {
      if (!selector || selector === '#rec') {
        console.warn('[Africa map] У страны не указан настоящий data-target:', selector);
        return;
      }
      const id = selector.charAt(0) === '#' ? selector.slice(1) : selector;
      const target = findTarget(selector);
      if (target) {
        const y = target.getBoundingClientRect().top + window.pageYOffset - 20;
        window.scrollTo({ top: y, behavior: 'smooth' });
        return;
      }
      console.warn('[Africa map] JS не нашёл блок, пробую переход через hash:', selector);
      window.location.hash = id;
    }

    document.addEventListener('click', function (event) {
      const country = event.target.closest && event.target.closest('#africa-scroll-nav .af-country.is-project');
      if (!country) return;
      event.preventDefault();
      event.stopPropagation();
      scrollToTarget(country.getAttribute('data-target'));
    }, true);

    function isSahelCountry(country) {
      return country && country.classList.contains('is-sahel');
    }

    root.addEventListener('mouseover', function (event) {
      const country = event.target.closest && event.target.closest('.af-country.is-project');
      if (!country) return;

      if (isSahelCountry(country)) {
        root.classList.add('is-sahel-hover');
        return;
      }

      root.classList.remove('is-sahel-hover');
      if (selectedText) {
        selectedText.textContent = (country.dataset.name || '') + ' — нажмите, чтобы перейти к\u00A0конкретному разделу.';
      }
    });

    root.addEventListener('mouseout', function (event) {
      const country = event.target.closest && event.target.closest('.af-country.is-project');
      if (!country) return;

      const related = event.relatedTarget;
      if (related && related.closest && related.closest('.af-country.is-sahel') && isSahelCountry(country)) {
        return;
      }

      root.classList.remove('is-sahel-hover');
      if (selectedText) {
        selectedText.textContent = 'Наведите курсор на\u00A0страну или нажмите на нее, чтобы перейти к\u00A0конкретному разделу. Либо продолжайте листать дальше.';
      }
    });

    return; // Десктоп закончен
  }

  // ---------- Мобильная логика (простой клик) ----------
  const svg = root.querySelector('.af-scroll-map__svg');
  const mobileInfo = root.querySelector('.af-scroll-map__mobile-info');
  const countryNameEl = mobileInfo.querySelector('.af-scroll-map__country-name');
  const countryDescEl = mobileInfo.querySelector('.af-scroll-map__country-desc');
  const confirmTextEl = mobileInfo.querySelector('.af-scroll-map__confirm-text');
  const yesButtons = mobileInfo.querySelectorAll('.af-scroll-map__yes-btn');

  // По умолчанию показываем подсказку
  const defaultEyebrow = root.querySelector('.af-scroll-map__caption-project .af-scroll-map__eyebrow');
  const defaultText = root.querySelector('.af-scroll-map__caption-project .af-scroll-map__text');
  const defaultSelected = root.querySelector('.af-scroll-map__caption-project .af-scroll-map__selected');

  // Скрываем десктопные текстовые блоки, показываем мобильный блок
  root.querySelector('.af-scroll-map__caption-ssa').style.display = 'none';
  root.querySelector('.af-scroll-map__caption-project').style.display = 'none';
  mobileInfo.style.display = 'block';

  // Начальное сообщение
  countryNameEl.textContent = '';
  countryDescEl.textContent = 'Кликните на страну, чтобы перейти к разделу';
  confirmTextEl.style.display = 'none';
  yesButtons.forEach(btn => btn.style.display = 'none');

  // Подсветка проектных стран — добавим класс is-project (если ещё не)
  root.classList.add('is-project');

  // Обработчик клика по стране
  svg.addEventListener('click', function(e) {
    const country = e.target.closest('.af-country');
    if (!country || !country.classList.contains('is-project')) return;

    e.preventDefault();
    const name = country.dataset.name || '';
    const isSahel = country.classList.contains('is-sahel');
    const targetSelector = country.dataset.target;

    // Формируем описание
    let desc = '';
    if (isSahel) {
      desc = `Это ${name}. Страна, которая входит в Альянс государств Сахеля.`;
    } else {
      desc = `Это ${name}.`;
    }

    // Показываем описание
    countryNameEl.textContent = name;
    countryDescEl.textContent = desc;

    // Показываем вопрос и кнопки
    confirmTextEl.style.display = 'block';
    yesButtons.forEach(btn => {
      btn.style.display = 'inline-block';
      // Привязываем переход к target
      btn.onclick = function() {
        if (targetSelector && targetSelector !== '#rec') {
          const target = document.querySelector(targetSelector);
          if (target) {
            const y = target.getBoundingClientRect().top + window.pageYOffset - 20;
            window.scrollTo({ top: y, behavior: 'smooth' });
          } else {
            window.location.hash = targetSelector.slice(1);
          }
        }
      };
      });
    });
  } // ← ЗАКРЫТИЕ initAfricaScrollMap
})(); // ← ЗАКРЫТИЕ IIFE
