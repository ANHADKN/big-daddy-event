document.addEventListener('DOMContentLoaded', () => {
    
    // 1. STICKY NAVIGATION
    const nav = document.querySelector('.site-nav');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // 2. MOBILE MENU TOGGLE & ACCESSIBILITY
    const menuToggle = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-links a');

    if (menuToggle && mobileMenu) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Toggle navigation menu');

        const toggleMenu = (open) => {
            const isOpen = typeof open === 'boolean' ? open : !mobileMenu.classList.contains('active');
            menuToggle.classList.toggle('active', isOpen);
            mobileMenu.classList.toggle('active', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            document.body.style.overflow = isOpen ? 'hidden' : '';
        };

        menuToggle.addEventListener('click', () => toggleMenu());

        mobileLinks.forEach(link => {
            link.addEventListener('click', () => toggleMenu(false));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                toggleMenu(false);
                menuToggle.focus();
            }
        });
    }

    // 3. GLOBAL ANIMATION SYSTEM (Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0
    };

    const revealElements = document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right, .clip-reveal, .image-reveal');

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                
                // If it's a clip-reveal, we also want to trigger image-reveal on its child if it exists
                if (entry.target.classList.contains('clip-reveal')) {
                    const img = entry.target.querySelector('.image-reveal');
                    if (img) img.classList.add('is-visible');
                }
                
                obs.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => observer.observe(el));
});
