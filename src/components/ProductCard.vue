<script setup>
import { Heart, Plus, Check, Image } from 'lucide-vue-next'
import { ref } from 'vue'
defineProps({ product: Object, saved: Boolean, selected: Boolean })
defineEmits(['open', 'save', 'add'])
const broken = ref(false)
const money = (value) => value === null ? 'Цена по запросу' : `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(value)} ₸`
</script>

<template>
  <article class="product-card">
    <div class="product-image">
      <button class="product-visual" :aria-label="`Подробнее: ${product.name}`" @click="$emit('open', product)">
        <img v-if="product.images?.[0] && !broken" :src="product.images[0]" :alt="product.name" loading="lazy" @error="broken = true" />
        <Image v-else class="image-placeholder" :size="64" :stroke-width="1" />
      </button>
      <span v-if="product.stock > 0" class="product-stock"><i></i> В наличии</span>
      <button class="favorite-button" :class="{ saved }" :aria-pressed="saved" :aria-label="saved ? 'Убрать из избранного' : 'В избранное'" @click="$emit('save', product)"><Heart :size="19" :fill="saved ? 'currentColor' : 'none'" /></button>
    </div>
    <div class="product-info">
      <div class="product-overline"><span>{{ product.brand || 'Коллекция MEDIAPRO' }}</span><span>арт. {{ product.article }}</span></div>
      <button class="product-title" @click="$emit('open', product)">{{ product.name }}</button>
      <div class="product-bottom"><div><strong>{{ money(product.price) }}</strong><span>за штуку · без нанесения</span></div><button class="add-button" :class="{ selected }" :aria-label="selected ? 'Товар в подборке' : 'Добавить в подборку'" @click="$emit('add', product)"><Check v-if="selected" :size="20" /><Plus v-else :size="21" /></button></div>
    </div>
  </article>
</template>
