/* Nuqthah Learning Center
   + Midtrans Snap Token Integration
*/
(function () {
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));

  // =========================
  // Basic UI (existing)
  // =========================

  // Year
  const y = qs('#year');
  if (y) y.textContent = new Date().getFullYear();

  // Mobile menu
  const burger = qs('#burger');
  const mobile = qs('#mobileMenu');
  const header = qs('.header');

  function setMenu(open) {
    burger?.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobile?.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!mobile) return;

    if (open) {
      mobile.style.display = 'block';
      requestAnimationFrame(() => mobile.classList.add('is-open'));
    } else {
      mobile.classList.remove('is-open');
      mobile.style.display = 'none';
    }
  }

  if (burger && mobile) {
    setMenu(false);
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      setMenu(open);
    });

    qsa('.mobile__link', mobile).forEach(a => a.addEventListener('click', () => setMenu(false)));

    document.addEventListener('click', (e) => {
      if (!header) return;
      const isInside = header.contains(e.target);
      if (!isInside) setMenu(false);
    });
  }

  // Reveal on scroll
  const revealEls = qsa('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(ent => {
      if (ent.isIntersecting) {
        ent.target.classList.add('is-in');
        io.unobserve(ent.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));

  // Count-up
  function animateCount(el) {
    const end = Number(el.getAttribute('data-count') || '0');
    const duration = 900;
    const start = performance.now();
    const from = 0;

    function tick(t) {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (end - from) * eased);
      el.textContent = val.toLocaleString('id-ID');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const countEls = qsa('[data-count]');
  const ioCount = new IntersectionObserver((entries) => {
    entries.forEach(ent => {
      if (ent.isIntersecting) {
        animateCount(ent.target);
        ioCount.unobserve(ent.target);
      }
    });
  }, { threshold: 0.35 });
  countEls.forEach(el => ioCount.observe(el));

  // Carousel
  const track = qs('#track');
  const prev = qs('#prev');
  const next = qs('#next');
  let index = 0;

  function setSlide(i) {
    if (!track) return;
    const slides = track.children.length;
    index = (i + slides) % slides;
    track.style.transform = `translateX(${-index * 100}%)`;
  }

  prev?.addEventListener('click', () => setSlide(index - 1));
  next?.addEventListener('click', () => setSlide(index + 1));

  // Auto-play
  let timer = null;
  function startAuto() {
    stopAuto();
    timer = setInterval(() => setSlide(index + 1), 5200);
  }
  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  if (track) {
    startAuto();
    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
  }

  // Hero tilt
  const heroCard = qs('.heroCard');
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  if (heroCard) {
    const strength = 10;
    heroCard.addEventListener('mousemove', (e) => {
      const r = heroCard.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = clamp((0.5 - py) * strength, -strength, strength);
      const ry = clamp((px - 0.5) * strength, -strength, strength);
      heroCard.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
    });
    heroCard.addEventListener('mouseleave', () => {
      heroCard.style.transform = 'rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  }

  // Toast helper
  function showToast(title, msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast__title">${title}</div>
      <div class="toast__msg">${msg}</div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Toast styles injected
  const style = document.createElement('style');
  style.textContent = `
    .toast{
      position:fixed; left:50%; bottom:84px; transform:translateX(-50%) translateY(12px);
      width:min(520px, calc(100% - 28px));
      background: rgba(0,0,0,.55);
      border:1px solid rgba(255,255,255,.16);
      backdrop-filter: blur(14px);
      border-radius: 18px;
      padding: 12px 14px;
      box-shadow: 0 30px 90px rgba(0,0,0,.45);
      opacity:0;
      transition: opacity .25s ease, transform .25s ease;
      z-index: 9999;
    }
    .toast.show{opacity:1; transform:translateX(-50%) translateY(0px)}
    .toast__title{font-weight:900; margin-bottom:2px}
    .toast__msg{color: rgba(255,255,255,.72); font-weight:700; font-size:13px; line-height:1.4}
  `;
  document.head.appendChild(style);

  // =========================
  // Checkout Modal + Midtrans Snap
  // =========================

  const modal = qs('#checkout');
  const modalBackdrop = qs('.modal__backdrop', modal || document);
  const closeBtns = qsa('[data-close="1"]', modal || document);

  const sumPkg = qs('#sumPkg');
  const sumTotal = qs('#sumTotal');
  const paketInput = qs('#paketInput');
  const hargaInput = qs('#hargaInput');
  const checkoutForm = qs('#checkoutForm');
  const payBtn = qs('#payBtn');

  function formatIDR(n) {
    return Number(n || 0).toLocaleString('id-ID');
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtns.forEach(b => b.addEventListener('click', closeModal));
  modalBackdrop?.addEventListener('click', closeModal);

  // Bind pricing buttons -> open modal
  const packageButtons = qsa('[data-package][data-price]');
  packageButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pkg = btn.getAttribute('data-package') || '—';
      const price = Number(btn.getAttribute('data-price') || '0');

      if (sumPkg) sumPkg.textContent = pkg;
      if (sumTotal) sumTotal.textContent = formatIDR(price);
      if (paketInput) paketInput.value = pkg;
      if (hargaInput) hargaInput.value = String(price);

      openModal();
    });
  });

  // Submit -> request token -> snap.pay(token)
  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!paketInput || !hargaInput) return;

    const fd = new FormData(checkoutForm);
    const nama = String(fd.get('nama') || '').trim();
    const wa = String(fd.get('wa') || '').trim();
    const paket = String(fd.get('paket') || paketInput.value || '').trim();
    const harga = Number(fd.get('harga') || hargaInput.value || 0);

    if (!nama || !wa || !paket) {
      showToast('Gagal', 'Nama/WhatsApp/Paket wajib diisi.');
      return;
    }

    // Kalau harga 0, anggap trial: arahkan ke WA atau kasih toast
    if (!harga || harga === 0) {
      showToast('Free Trial', 'Silakan chat admin untuk akses trial.');
      window.open('https://youtube.com/playlist?list=PL--pbOUAJiY2j18rRbV6Kf_W1cG-wmZZd&si=j6JxClhqODcheWiP', '_blank');
      return;
    }

    try {
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = 'Memproses...';
      }

      // Request token ke backend (same-origin, aman untuk deploy)
      const API_URL = "/api/midtrans-token";

      // IMPORTANT: jangan kirim `harga` dari client (bisa dimanipulasi). Server yang menentukan harga via PRICE_MAP.
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, wa, paket })
      });


      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const msg = data?.error || 'Gagal membuat token.';
        showToast('Error', msg);
        return;
      }

      const token = data?.token;
      if (!token) {
        showToast('Error', 'Token kosong dari server.');
        return;
      }

      // Pastikan snap.js sudah kebaca
      if (!window.snap || typeof window.snap.pay !== 'function') {
        showToast('Snap belum siap', 'snap.js belum ter-load. Pastikan script Midtrans Snap ada di index.html.');
        return;
      }

      // Tutup modal sebelum bayar (opsional)
      closeModal();

      window.snap.pay(token, {
        onSuccess: function () {
          showToast('Berhasil ✅', 'Pembayaran sukses. Admin akan menghubungi kamu.');
        },
        onPending: function () {
          showToast('Pending ⏳', 'Menunggu pembayaran. Silakan selesaikan pembayaran.');
        },
        onError: function () {
          showToast('Gagal ❌', 'Pembayaran gagal. Coba lagi.');
        },
        onClose: function () {
          // user menutup popup
        },
      });

    } catch (err) {
      console.error(err);
      showToast('Error', err?.message || 'Terjadi kesalahan.');
    } finally {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = 'Bayar Sekarang';
      }
    }
  });

  // Optional: demo form “minat”
  const submitBtn = qs('#submitBtn');
  submitBtn?.addEventListener('click', () => {
    showToast('Terkirim ✅', 'Ini demo UI. Hubungkan form ke backend/Google Form saat hosting.');
  });

})();
