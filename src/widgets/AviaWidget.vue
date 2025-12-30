<template>
  <div class="container py-10">
    <iframe
        ref="iframeRef"
        src="/widget.html"
        class="etm-widget-iframe"
        :class="{ 'iframe-expanded': isExpanded }"
        frameborder="0"
        scrolling="no"
        allow="geolocation"
        @load="setupMessageListener"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const iframeRef = ref<HTMLIFrameElement | null>(null)
const isExpanded = ref(false)

const handleMessage = (event: MessageEvent) => {
  if (event.data?.type === 'etm-widget-state') {
    // Виджет сообщает, открыт ли календарь/выпадающий список
    isExpanded.value = event.data.isExpanded
  }

  if (event.data?.type === 'etm-widget-height' && iframeRef.value) {
    // Динамическая высота контента
    const height = event.data.height
    iframeRef.value.style.height = height + 'px'
  }
}

const setupMessageListener = () => {
  window.addEventListener('message', handleMessage)
}

onMounted(() => {
  window.addEventListener('message', handleMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
})
</script>

<style scoped>
.etm-widget-iframe {
  width: 100%;
  height: 350px;
  border: none;
  border-radius: 16px;
  overflow: hidden;
  transition: height 0.3s ease;
}

.etm-widget-iframe.iframe-expanded {
  height: 800px !important;
  overflow: visible;
}

@media screen and (max-width: 768px) {
  .etm-widget-iframe {
    height: 400px;
  }

  .etm-widget-iframe.iframe-expanded {
    height: 900px !important;
  }
}
</style>