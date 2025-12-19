<template>
  <div class="container py-10">
    <iframe
        ref="iframeRef"
        src="/widget.html"
        class="etm-widget-iframe"
        frameborder="0"
        scrolling="no"
        @load="adjustHeight"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const iframeRef = ref<HTMLIFrameElement | null>(null)

const adjustHeight = () => {
  if (iframeRef.value) {
    try {
      const body = iframeRef.value.contentWindow?.document?.body
      if (body) {
        iframeRef.value.style.height = body.scrollHeight + 'px'
      }
    } catch (e) {
      // Fallback если не можем получить доступ к содержимому
      iframeRef.value.style.height = '350px'
    }
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // Подгоняем высоту при изменении размера окна
  window.addEventListener('resize', adjustHeight)

  // Повторная подгонка через небольшую задержку (виджет может загружаться)
  setTimeout(adjustHeight, 1000)
  setTimeout(adjustHeight, 2000)
})

onUnmounted(() => {
  window.removeEventListener('resize', adjustHeight)
})
</script>

<style scoped>
.etm-widget-iframe {
  width: 100%;
  height: 350px;
  border: none;
  border-radius: 16px;
  overflow: hidden;
}

@media screen and (max-width: 768px) {
  .etm-widget-iframe {
    height: 400px;
  }
}
</style>