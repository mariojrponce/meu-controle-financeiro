// tema-inicial.js
// Roda no <head>, antes de a página aparecer. Fica num arquivo (e não num
// <script> solto no HTML) para o CSP poder proibir scripts embutidos.
(function () {
    // Não deixa o sistema abrir dentro de um iframe de outro site (clickjacking).
    // O GitHub Pages não envia X-Frame-Options, então o bloqueio é feito aqui.
    if (window.top !== window.self) {
        document.documentElement.style.display = "none";
        try { window.top.location = window.self.location.href; } catch (e) { /* outro domínio: só fica escondido */ }
        return;
    }

    // Tema (claro/escuro) aplicado cedo para a tela não piscar na cor errada.
    var t = null;
    try { t = localStorage.getItem("tema_meu_financeiro"); } catch (e) { /* sem acesso ao armazenamento */ }
    if (t !== "light" && t !== "dark") { var h = new Date().getHours(); t = (h >= 6 && h < 18) ? "light" : "dark"; }
    document.documentElement.setAttribute("data-theme", t);
})();
