<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { detectOS, isTauri } from '$lib/utils/tauriUtils';

  // Only load Parity Deals for:
  // 1. Web version (not Tauri desktop app)
  // 2. Windows users
  const shouldLoadParityDeals = browser && !isTauri && detectOS() == 'Windows';

  onMount(() => {
    if (!shouldLoadParityDeals) {
      return;
    }

    // Delay loading significantly to ensure main content is LCP, not the banner
    // Wait for page to be fully loaded and LCP recorded (usually happens ~2.5s)
    const loadParityDeals = () => {
      // Load Parity Deals SDK
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.defer = true;
      script.innerHTML = `
        function resolvePdSDKFunction(e,...t){return new Promise((n,i)=>{!function r(){window.PDPromotionUISDK&&"function"==typeof window.PDPromotionUISDK[e]?window.PDPromotionUISDK[e](...t).then(n).catch(i):setTimeout(r,100)}()})}!function(e,t,n,i,r,a,c){e[i]=e[i]||function(){(e[i].q=e[i].q||[]).push(Array.prototype.slice.call(arguments))},a=t.createElement(n),c=t.getElementsByTagName(n)[0],a.id="parity-deals-sdk",a.async=1,a.src=r,c.parentNode.insertBefore(a,c)}(window,document,"script","PDPromotionUISDK","https://cdn.paritydeals.com/js-promotions-ui/1.0.0/js-promotions-ui.umd.js"),window.PDPromotionUI={init:function(e){return resolvePdSDKFunction("init",e)},getUpdatedPrice:function(e,t){return resolvePdSDKFunction("getUpdatedPrice",e,t)},updatePriceElement:function(e,t){return resolvePdSDKFunction("updatePriceElement",e,t)},updatePrice:function(e){return resolvePdSDKFunction("updatePrice",e)}};
        PDPromotionUI.init({
          productId: 'promo_b741065231924afbb58578edb55cc43a',
          banner: {
            showCloseButton: true,
          },
          showBanner: true
        });
      `;
      
      document.body.appendChild(script);
    };

    // Wait for window load event, then add additional delay
    // This ensures all main content is loaded and LCP is recorded
    if (document.readyState === 'complete') {
      // Page already loaded, delay by 2 seconds
      const timeoutId = setTimeout(loadParityDeals, 2000);
      return () => clearTimeout(timeoutId);
    } else {
      // Wait for page load, then delay an additional 2 seconds
      const handleLoad = () => {
        setTimeout(loadParityDeals, 2000);
      };
      window.addEventListener('load', handleLoad, { once: true });
      return () => {
        window.removeEventListener('load', handleLoad);
      };
    }
  });
</script>

<style>
  /* Ensure Parity banner doesn't affect LCP by initially hiding it */
  :global(.parity-banner-inner) {
    opacity: 0;
    animation: fadeInBanner 0.5s ease-in 0.3s forwards;
  }

  @keyframes fadeInBanner {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>

<!-- This component has no visual output, it just conditionally loads the Parity Deals script -->
