/* Baganti site behaviour: language (EN/中文/FR), navigation drawer, product tabs, resource filters, FAQ, contact form, videos. */
(function () {
    'use strict';

    /* ---------- Shared header + footer (partials/header.html, partials/footer.html) ---------- */
    // Site root = wherever assets/js/site.js lives, so the site also works from a subfolder.
    const ROOT = document.currentScript.src.replace(/assets\/js\/site\.js(\?.*)?$/, '');
    const absolute = /^(?:[a-z]+:|#|\/)/i;
    const loadPartial = slot => fetch(ROOT + 'partials/' + slot.dataset.include + '.html')
        .then(r => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.text(); })
        .then(markup => {
            const tpl = document.createElement('template');
            tpl.innerHTML = markup;
            tpl.content.querySelectorAll('[href], [src]').forEach(el => ['href', 'src'].forEach(attr => {
                const v = el.getAttribute(attr);
                if (v !== null && !absolute.test(v)) el.setAttribute(attr, new URL(v, ROOT).href);
            }));
            slot.replaceWith(tpl.content);
        })
        .catch(err => console.error('Could not load partial', slot.dataset.include, err));

    /* ---------- Language: EN / 中文 / FR ----------
       Pages are authored in English. assets/lang/<lang>.json maps each English text
       (whitespace-collapsed) to its translation; untranslated text stays English. */
    const LANGS = { en: 'en', zh: 'zh-Hans', fr: 'fr' };
    const store = { get: () => { try { return localStorage.getItem('baganti-lang'); } catch (e) { return null; } },
        set: v => { try { localStorage.setItem('baganti-lang', v); } catch (e) { /* private mode */ } } };
    const pickLang = () => {
        const q = new URLSearchParams(location.search).get('lang');
        if (LANGS[q]) { store.set(q); return q; }
        const saved = store.get();
        if (LANGS[saved]) return saved;
        const nav = (navigator.languages || [navigator.language || 'en']).map(l => l.slice(0, 2).toLowerCase());
        return nav.find(l => LANGS[l]) || 'en';
    };
    const LANG = pickLang();
    let dict = {};
    const t = (s, n) => (dict[s] || s).replace('{n}', n);
    document.documentElement.lang = LANGS[LANG];
    if (LANG !== 'en') {
        document.documentElement.classList.add('i18n-loading');
        setTimeout(() => document.documentElement.classList.remove('i18n-loading'), 2500); // never leave the page hidden
    }
    const loadDict = () => LANG === 'en' ? Promise.resolve() : fetch(ROOT + 'assets/lang/' + LANG + '.json')
        .then(r => r.json()).then(d => { dict = d; })
        .catch(err => console.error('Could not load language', LANG, err));

    const translatePage = () => {
        if (LANG === 'en') return;
        const tr = s => {
            const key = s.replace(/\s+/g, ' ').trim();
            return dict[key] ? s.replace(/^(\s*)[\s\S]*?(\s*)$/, (m, a, b) => a + dict[key] + b) : s;
        };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => n.parentElement.closest('script, style, svg, [translate="no"]')
                ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        for (let n; (n = walker.nextNode());) n.nodeValue = tr(n.nodeValue);
        document.querySelectorAll('[alt], [aria-label], [placeholder], [title]').forEach(el =>
            ['alt', 'aria-label', 'placeholder', 'title'].forEach(a => { if (el.hasAttribute(a)) el.setAttribute(a, tr(el.getAttribute(a))); }));
        document.title = tr(document.title);
        const desc = document.querySelector('meta[name="description"]');
        if (desc) desc.content = tr(desc.content);
        // Resource search also matches the translated wording.
        document.querySelectorAll('[data-search]').forEach(el => { el.dataset.search += ' ' + el.textContent.replace(/\s+/g, ' ').toLowerCase(); });
    };

    const setupLangSwitch = () => document.querySelectorAll('[data-lang]').forEach(b => {
        const on = b.dataset.lang === LANG;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
        b.addEventListener('click', () => {
            if (on) return;
            store.set(b.dataset.lang);
            const url = new URL(location.href);
            url.searchParams.delete('lang');
            location.href = url.href;
        });
    });

    const start = () => Promise.all([...Array.from(document.querySelectorAll('[data-include]'), loadPartial), loadDict()])
        .then(() => {
            translatePage();
            setupLangSwitch();
            document.documentElement.classList.remove('i18n-loading');
            init();
        });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    function init() {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const press = (buttons, active, cls = 'is-active') => buttons.forEach(b => {
        const on = b === active;
        b.classList.toggle(cls, on);
        b.setAttribute('aria-pressed', on);
    });

    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

    /* ---------- Navigation drawer ---------- */
    const toggle = $('.system-menu-toggle');
    const drawer = $('#site-navigation-drawer');
    const backdrop = $('.system-drawer-backdrop');
    if (toggle && drawer) {
        let open = false;
        const groups = $$('.system-drawer-group', drawer);
        const setGroup = active => groups.forEach(g => {
            const on = g === active;
            g.classList.toggle('is-open', on);
            $('.system-drawer-toggle', g).setAttribute('aria-expanded', on);
            $('.system-drawer-panel', g).hidden = !on;
        });
        const setOpen = next => {
            open = next;
            document.body.classList.toggle('menu-open', open);
            toggle.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', open);
            toggle.setAttribute('aria-label', t(open ? 'Close navigation' : 'Open navigation'));
            $('span', toggle).textContent = t(open ? 'Close' : 'Menu');
            backdrop.classList.toggle('is-open', open);
            backdrop.tabIndex = open ? 0 : -1;
            drawer.classList.toggle('is-open', open);
            drawer.setAttribute('aria-hidden', !open);
            if (open) requestAnimationFrame(() => $('a[href], button:not([disabled])', drawer)?.focus());
            else setGroup(null);
        };
        toggle.addEventListener('click', () => setOpen(!open));
        backdrop.addEventListener('click', () => setOpen(false));
        // The label is a link to the section page; the + button expands the panel.
        groups.forEach(g => $('.system-drawer-toggle', g).addEventListener('click', () =>
            setGroup(g.classList.contains('is-open') ? null : g)));
        drawer.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
        $('.system-brand')?.addEventListener('click', () => setOpen(false));
        window.addEventListener('keydown', e => {
            if (!open) return;
            if (e.key === 'Escape') { setOpen(false); toggle.focus(); }
            if (e.key === 'Tab') {
                const f = $$('a[href], button:not([disabled])', drawer).filter(el => el.offsetParent !== null);
                if (!f.length) return;
                if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
                else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
            }
        });
    }

    /* ---------- Product family tabs (/products/) ---------- */
    $$('[data-tabs]').forEach(list => {
        const tabs = $$('[role="tab"]', list);
        const select = tab => tabs.forEach(t => {
            const on = t === tab;
            t.classList.toggle('is-active', on);
            t.setAttribute('aria-selected', on);
            t.tabIndex = on ? 0 : -1;
            document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
        tabs.forEach(t => t.addEventListener('click', () => select(t)));
        list.addEventListener('keydown', e => {
            const i = Math.max(0, tabs.indexOf(document.activeElement));
            const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            const t = tabs[(next + tabs.length) % tabs.length];
            t.focus();
            select(t);
        });
    });

    /* ---------- Resource library search (/resources/) ---------- */
    const explorer = $('[data-resource-explorer]');
    if (explorer) {
        const input = $('#resource-search', explorer);
        const typeSel = $('[data-type-filter]', explorer);
        const famBtns = $$('[data-family-filter]', explorer);
        const items = $$('[data-search]', explorer);
        const dividers = $$('.final-resource-family-divider', explorer);
        let family = 'All';
        const apply = () => {
            const q = input.value.trim().toLowerCase();
            const type = typeSel.value;
            let n = 0;
            items.forEach(el => {
                const show = (family === 'All' || el.dataset.family === family)
                    && (type === 'All' || el.dataset.type === type)
                    && (!q || el.dataset.search.includes(q));
                el.hidden = !show;
                if (show) n++;
            });
            dividers.forEach(d => { d.hidden = !items.some(el => !el.hidden && el.dataset.family === d.dataset.family); });
            $('[data-count]', explorer).textContent = t('{n} results', n);
            $('.final-resource-empty', explorer).hidden = n > 0;
        };
        input.addEventListener('input', apply);
        typeSel.addEventListener('change', apply);
        famBtns.forEach(b => b.addEventListener('click', () => { family = b.dataset.familyFilter; press(famBtns, b); apply(); }));
    }

    /* ---------- Family resource library (/resources/<family>/) ---------- */
    const famPage = $('[data-resource-family]');
    if (famPage) {
        const prodBtns = $$('[data-product]', famPage);
        const purpBtns = $$('button[data-purpose]', famPage);
        const docs = $$('.resource-document-list article', famPage);
        let product = 'all', purpose = 'understand';
        const apply = () => {
            let n = 0;
            docs.forEach(d => {
                const show = d.dataset.purpose === purpose
                    && (product === 'all' || d.dataset.products === 'all' || d.dataset.products.split(' ').includes(product));
                d.hidden = !show;
                if (show) n++;
            });
            press(prodBtns, prodBtns.find(b => b.dataset.product === product));
            const pb = purpBtns.find(b => b.dataset.purpose === purpose);
            press(purpBtns, pb);
            $('[data-purpose-label]', famPage).textContent = $('strong', pb).textContent;
            $('[data-count]', famPage).textContent = t(n === 1 ? '{n} resource' : '{n} resources', n);
        };
        const hash = location.hash.slice(1);
        if (purpBtns.some(b => b.dataset.purpose === hash)) purpose = hash;
        const qp = new URLSearchParams(location.search).get('product');
        if (prodBtns.some(b => b.dataset.product === qp)) product = qp;
        prodBtns.forEach(b => b.addEventListener('click', () => { product = b.dataset.product; apply(); }));
        purpBtns.forEach(b => b.addEventListener('click', () => {
            purpose = b.dataset.purpose;
            history.replaceState(null, '', location.pathname + location.search + '#' + purpose);
            apply();
        }));
        apply();
    }

    /* ---------- FAQ categories ---------- */
    const faqBtns = $$('[data-faq-group]');
    faqBtns.forEach(b => b.addEventListener('click', () => {
        press(faqBtns, b, 'active');
        $$('[data-faq-panel]').forEach(p => { p.hidden = p.dataset.faqPanel !== b.dataset.faqGroup; });
    }));

    /* ---------- Contact form ---------- */
    const form = $('.final-project-form');
    if (form) {
        const PRODUCTS = {
            LumosCielo: ['LumosCielo Standard', 'LumosCielo Custom'],
            LumosPerfora: ['LumosPerfora Metal', 'LumosPerfora Faux Metal'],
            LumosForma: ['LumosForma Frame — Non-Lit SEG', 'LumosForma Light — Backlit SEG'],
            Lumosanti: ['Lumosanti Pure', 'Lumosanti Tune', 'Lumosanti Colour', 'Lumosanti Pixel'],
            'Cross-family': ['Multiple systems']
        };
        const FAMILY = { lumoscielo: 'LumosCielo', lumosanti: 'Lumosanti', 'retail-displays': 'LumosForma', 'retail displays': 'LumosForma',
            lumosforma: 'LumosForma', lumosperfora: 'LumosPerfora', custom: 'Cross-family' };
        const REQUEST = { support: 'Technical support', document: 'Document request', representative: 'Representative request' };
        const fam = form.elements.family, prod = form.elements.product;
        const fillProducts = () => {
            prod.innerHTML = '';
            prod.add(new Option(t('I don’t know yet'), ''));
            (PRODUCTS[fam.value] || []).forEach(p => prod.add(new Option(t(p), p)));
            prod.disabled = !fam.value;
        };
        const params = new URLSearchParams(location.search);
        if (REQUEST[params.get('request')]) form.elements.requestType.value = REQUEST[params.get('request')];
        const f = (params.get('family') || '').toLowerCase();
        if (FAMILY[f]) fam.value = FAMILY[f];
        fillProducts();
        fam.addEventListener('change', fillProducts);
        const status = $('.form-status', form), send = $('button[type=submit]', form);
        const show = (cls, text) => { status.hidden = false; status.className = 'form-status ' + cls; status.textContent = text; };
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const d = new FormData(form);
            send.disabled = true;
            show('', t('Sending…'));
            try {
                const r = await fetch(ROOT + 'api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(d)) });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                form.reset();
                fillProducts();
                show('is-ok', t('Thank you. Your message has been sent and Baganti will reply by email.'));
            } catch (err) {
                // Sending failed: offer the same request as a prefilled email instead.
                console.error('Contact form', err);
                show('is-error', t('Your message could not be sent. Please try again or email') + ' ');
                const a = document.createElement('a');
                a.href = mailto(d);
                a.textContent = 'info@baganti.com';
                status.append(a, LANG === 'zh' ? '。' : '.');
            }
            send.disabled = false;
        });
        function mailto(d) {
            const subject = (d.get('requestType') || 'Website inquiry') + ' — ' + (d.get('family') || 'Baganti');
            const bodyText = [
                'Request type: ' + (d.get('requestType') || 'Project inquiry'),
                'Name: ' + d.get('name'),
                'Company: ' + (d.get('company') || '—'),
                'Email: ' + d.get('email'),
                'Project family: ' + (d.get('family') || 'Not sure'),
                'Product: ' + (d.get('product') || 'Not sure yet'),
                'Project stage: ' + (d.get('stage') || 'Not specified'),
                '',
                String(d.get('message') || '')
            ].join('\n');
            return 'mailto:info@baganti.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyText);
        }
    }

    /* ---------- LumosCielo Custom: switch preview loop to the full video ---------- */
    $$('.custom-video-mode-button').forEach(btn => btn.addEventListener('click', () => {
        const video = btn.parentElement.querySelector('video');
        if (!video) return;
        const full = video.cloneNode(false);
        full.controls = true;
        full.preload = 'auto';
        full.setAttribute('aria-label', t('Full LumosCielo Custom amorphous product presentation'));
        const src = document.createElement('source');
        src.src = video.querySelector('source').getAttribute('src').replace('-preview.mp4', '-detail.mp4');
        src.type = 'video/mp4';
        full.appendChild(src);
        video.replaceWith(full);
        full.play().catch(() => {});
        btn.remove();
    }));
    }
})();

/* ---------- Home page entrance motion (index.html only) ----------
   Progressive enhancement: the CSS that hides elements is gated on
   html.anim-ready, which is only set here, so the page stays fully
   visible if this script never runs or motion is turned down. */
(function () {
    'use strict';

    const start = () => {
        const home = document.querySelector('.final-home');
        if (!home) return;
        if (!('IntersectionObserver' in window)) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        /* ---- Opening sequence: the hero "switches on" ----
           Headline lines rise behind a mask, a Signal Cyan light sweeps the
           baseline, and the photo lifts from dimmed to full brightness. */
        const copy = home.querySelector('.final-home-hero-copy');
        const h1 = copy && copy.querySelector('h1');
        if (h1) {
            h1.innerHTML = h1.innerHTML.split(/<br\s*\/?>/i)
                .map((line, i) => `<span class="hero-line" style="--reveal-delay:${i * 110}ms"><span>${line}</span></span>`)
                .join('');
            const sweep = document.createElement('i');
            sweep.className = 'hero-sweep';
            sweep.setAttribute('aria-hidden', 'true');
            h1.after(sweep);
            Array.from(copy.children).forEach(el => {
                if (el === h1 || el === sweep) return;
                el.classList.add('hero-fade');
                el.style.setProperty('--reveal-delay', '560ms');
            });
            document.documentElement.classList.add('lightup');
            const lightUp = () => document.documentElement.classList.add('lightup-on');
            requestAnimationFrame(() => requestAnimationFrame(lightUp));
            setTimeout(lightUp, 1200); // never leave the hero dark if anything stalls
        }

        // [selector, stagger step in ms] - text blocks only; photos are never animated
        const groups = [
            ['.home-product-heading > div, .home-product-heading > p', 90],
            ['.home-product-card .home-product-copy', 80],
            ['.final-applications .final-section-heading > div', 0],
            ['.final-capability-copy > *', 80],
            ['.final-home-resources > div', 90],
            ['.final-home-cta > div', 90]
        ];

        const items = [];
        groups.forEach(([sel, step]) => {
            Array.from(home.querySelectorAll(sel)).forEach((el, i) => {
                el.classList.add('reveal');
                if (step) el.style.setProperty('--reveal-delay', i * step + 'ms');
                items.push(el);
            });
        });
        if (!items.length) return;

        document.documentElement.classList.add('anim-ready');

        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                obs.unobserve(e.target);
            });
        }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

        items.forEach(el => io.observe(el));

        // Fallback: if the observer never ran (page opened in a background tab,
        // scroll position restored, observer throttled), reveal whatever is
        // actually on screen. Anything further down still animates on scroll.
        const sweep = () => items.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.top < window.innerHeight * 0.92 && r.bottom > 0) el.classList.add('is-in');
        });
        window.addEventListener('load', () => setTimeout(sweep, 800), { once: true });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') setTimeout(sweep, 120);
        });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
