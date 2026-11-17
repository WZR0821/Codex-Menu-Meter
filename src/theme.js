// 明暗外观：主进程把设置里的外观写进 nativeTheme.themeSource，
// 渲染层的 prefers-color-scheme 随之变化；这里只把结果落到 <html data-appearance>，样式据此切换。
(function () {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    document.documentElement.dataset.appearance = media.matches ? 'dark' : 'light';
  }
  apply();
  media.addEventListener('change', apply);
})();
