<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ArrowUpRight, ArrowRight, ArrowLeft, Search, Heart, ShoppingBag, Menu, X, ChevronDown, ChevronRight, SlidersHorizontal, Check, Plus, Minus, Trash2, LoaderCircle, Gift, Shirt, Backpack, Coffee, Laptop, NotebookPen, Plane, Sparkles, Phone, PackageCheck, Palette, Truck, Image as ImageIcon } from 'lucide-vue-next'
import ProductCard from './components/ProductCard.vue'
import { api } from './api'
import { formatMoney, formatRetailPrice, retailPriceInTiyn } from './pricing'

const icons = { drinkware: Coffee, apparel: Shirt, bags: Backpack, office: NotebookPen, tech: Laptop, sets: Gift, leisure: Plane, accessories: Sparkles }
const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
const cart = ref(readStorage('mediapro-cart', []).filter(x => Number.isInteger(x.id) && Number.isInteger(x.quantity) && x.quantity > 0))
const favorites = ref(readStorage('mediapro-favorites', []).filter(x => Number.isInteger(x.id)))
const isCatalogPage = /^\/catalog(?:\/index\.html|\/)?$/.test(window.location.pathname)
const catalogParams = new URLSearchParams(window.location.search)
const section = ref(isCatalogPage ? 'catalog' : 'home')
const mobileMenu = ref(false)
const categories = ref([])
const featured = ref([])
const products = ref([])
const meta = ref({ total: 0 })
const pagination = ref({ total: 0, current_page: 1, last_page: 1 })
const query = ref(isCatalogPage ? catalogParams.get('q') || '' : '')
const initialCategory = catalogParams.get('category')
const category = ref(isCatalogPage && !query.value.trim() && Object.hasOwn(icons, initialCategory) ? initialCategory : '')
const searchInput = computed({
  get: () => query.value,
  set: value => {
    query.value = value
    if (value.trim()) category.value = ''
  },
})
const provider = ref('')
const inStock = ref(false)
const maxPrice = ref('')
const sort = ref('recommended')
const loading = ref(false)
const catalogError = ref('')
const initError = ref('')
const filterOpen = ref(false)
const toast = ref('')
const activeProduct = ref(null)
const selectedImage = ref(0)
const failedDetailImages = ref(new Set())
const detailImages = computed(() => (activeProduct.value?.images ?? []).filter(image => !failedDetailImages.value.has(image)))
const detailImage = computed(() => detailImages.value[selectedImage.value])

function markDetailImageFailed(image) {
  if (failedDetailImages.value.has(image)) return
  const failedIndex = detailImages.value.indexOf(image)
  failedDetailImages.value.add(image)
  if (failedIndex >= 0 && failedIndex < selectedImage.value) selectedImage.value--
  selectedImage.value = Math.min(selectedImage.value, Math.max(0, detailImages.value.length - 1))
}
const productDialog = ref(null)
const cartDialog = ref(null)
const privacyDialog = ref(null)
const form = ref({ name: '', phone: '', email: '', company: '', message: '', consent: false, website: '' })
const submitting = ref(false)
const submitError = ref('')
const success = ref('')
const cartCount = computed(() => cart.value.length)
const cartTotal = computed(() => cart.value.reduce((sum, p) => sum + retailPriceInTiyn(p.price, p.provider) * p.quantity, 0))
const hasUnknownPrice = computed(() => cart.value.some(p => p.price === null))
const formatNumber = value => new Intl.NumberFormat('ru-KZ').format(value)
const heroProducts = computed(() => ['drinkware', 'bags', 'office'].map(cat => featured.value.find(p => p.category === cat)).filter(Boolean))
const displayed = computed(() => section.value === 'favorites' ? favorites.value : section.value === 'catalog' ? products.value : featured.value)
const filterCount = computed(() => [category.value, provider.value, inStock.value, maxPrice.value].filter(Boolean).length)
let controller, searchTimer, toastTimer

watch(cart, value => { try { localStorage.setItem('mediapro-cart', JSON.stringify(value)) } catch {} }, { deep: true })
watch(favorites, value => { try { localStorage.setItem('mediapro-favorites', JSON.stringify(value)) } catch {} }, { deep: true })

function notify(message) { toast.value = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 3000) }
const isSaved = p => favorites.value.some(x => x.id === p.id)
const isSelected = p => cart.value.some(x => x.id === p.id)
function save(p) {
  if (isSaved(p)) favorites.value = favorites.value.filter(x => x.id !== p.id)
  else { favorites.value.push(p); notify('Сохранено в избранном') }
}
function add(p) {
  if (isSelected(p)) { openCart(); return }
  if (cart.value.length >= 50) return notify('В подборку можно добавить до 50 товаров')
  cart.value.push({ ...p, quantity: 50 })
  notify('Товар добавлен в вашу подборку')
}
async function openProduct(p) {
  failedDetailImages.value = new Set()
  activeProduct.value = p; selectedImage.value = 0
  await nextTick(); productDialog.value.showModal()
  try {
    const result = await api(`/products/${p.id}`)
    if (activeProduct.value?.id === p.id) activeProduct.value = result.data
  } catch { notify('Не удалось обновить товар. Наличие уточним при расчёте.') }
}
function openCart() { success.value = ''; submitError.value = ''; mobileMenu.value = false; cartDialog.value.showModal() }
function openRequest(message = '') { if (message) form.value.message = message; openCart() }
function resetFilters() { query.value = ''; category.value = ''; provider.value = ''; inStock.value = false; maxPrice.value = ''; sort.value = 'recommended' }
function selectCategory(slug) {
  query.value = ''
  category.value = slug
}
function changePage(page) { loadCatalog(page); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }) }
function goCatalog(cat = '') {
  category.value = cat; mobileMenu.value = false
  if (section.value === 'catalog') loadCatalog()
  else { window.location.assign(cat ? `/catalog/?category=${encodeURIComponent(cat)}` : '/catalog/') }
  nextTick(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }))
}
function onHash() {
  const hash = window.location.hash.slice(1)
  if (!isCatalogPage && hash === 'catalog') {
    window.location.replace('/catalog/')
    return
  }
  section.value = hash === 'favorites' ? 'favorites' : isCatalogPage ? 'catalog' : 'home'
  mobileMenu.value = false
  if (section.value === 'catalog') loadCatalog()
  nextTick(() => {
    if (['about', 'branding', 'contacts', 'catalog', 'favorites'].includes(hash)) document.getElementById(hash === 'favorites' ? 'catalog' : hash)?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}
async function loadCatalog(page = 1) {
  controller?.abort(); controller = new AbortController()
  const signal = controller.signal
  loading.value = true; catalogError.value = ''
  const params = new URLSearchParams({ page, sort: sort.value, per_page: 24, price_basis: 'retail' })
  if (query.value.trim()) params.set('q', query.value.trim())
  if (category.value) params.set('category', category.value)
  if (provider.value) params.set('provider', provider.value)
  if (inStock.value) params.set('in_stock', '1')
  if (maxPrice.value !== '' && Number(maxPrice.value) >= 0) params.set('max_price', maxPrice.value)
  try {
    const result = await api(`/products?${params}`, { signal })
    products.value = result.data; pagination.value = result.meta
  } catch (e) { if (e.name !== 'AbortError') catalogError.value = e.message }
  finally { if (!signal.aborted) loading.value = false }
}
watch([query, category, provider, inStock, maxPrice, sort], ([value], [previousValue]) => {
  clearTimeout(searchTimer)
  if (value === previousValue || !value.trim()) {
    if (section.value === 'catalog') loadCatalog()
    return
  }

  searchTimer = setTimeout(() => {
    if (section.value === 'catalog') loadCatalog()
    else window.location.assign(`/catalog/?q=${encodeURIComponent(value.trim().slice(0, 150))}`)
  }, 350)
})
async function initialize() {
  initError.value = ''
  try {
    const [info, selection] = await Promise.all([api('/catalog/meta'), api('/catalog/featured')])
    categories.value = info.categories; meta.value = info; featured.value = selection.data
  } catch { initError.value = 'Каталог временно недоступен. Попробуйте обновить или свяжитесь с нами — поможем с подбором.' }
}
async function submitInquiry() {
  submitting.value = true; submitError.value = ''
  try {
    const result = await api('/inquiries', { method: 'POST', body: JSON.stringify({ ...form.value, items: cart.value.map(p => ({ id: p.id, quantity: p.quantity })) }) })
    success.value = result.id; cart.value = []; form.value = { name: '', phone: '', email: '', company: '', message: '', consent: false, website: '' }
  } catch (e) { submitError.value = e.message }
  finally { submitting.value = false }
}
function backdrop(event, dialog) { if (event.target === dialog) dialog.close() }
function fallbackImage(event) { event.target.style.visibility = 'hidden' }
onMounted(() => { initialize(); onHash(); window.addEventListener('hashchange', onHash) })
onUnmounted(() => { controller?.abort(); clearTimeout(searchTimer); clearTimeout(toastTimer); window.removeEventListener('hashchange', onHash) })
</script>

<template>
  <div class="site-shell">
    <div class="topbar"><div class="container topbar-inner"><span>Мерч, который становится частью жизни</span><a href="tel:+77073544719">Казахстан <span class="topbar-dot">·</span> +7 (707) 354-47-19 <ArrowUpRight :size="13" /></a></div></div>
    <header class="site-header">
      <div class="container header-inner">
        <a class="logo" href="/" aria-label="MEDIAPRO — главная">MEDIA<span>PRO</span><i>®</i></a>
        <nav class="desktop-nav" aria-label="Основная навигация"><a href="/catalog/" :class="{ active: section === 'catalog' }">Каталог <ChevronDown :size="13" /></a><a href="/#branding">Нанесение</a><a href="/#about">О нас</a><a href="/#contacts">Контакты</a></nav>
        <div class="header-actions"><a class="icon-button favorite-link" href="/#favorites" aria-label="Избранное"><Heart :size="21" /><span v-if="favorites.length" class="counter">{{ favorites.length }}</span></a><button class="cart-button" @click="openCart"><ShoppingBag :size="19" /><span>Моя подборка</span><b>{{ cartCount }}</b></button><button class="icon-button mobile-menu-button" aria-label="Открыть меню" :aria-expanded="mobileMenu" @click="mobileMenu = !mobileMenu"><X v-if="mobileMenu" /><Menu v-else /></button></div>
      </div>
      <nav v-if="mobileMenu" class="mobile-nav" aria-label="Мобильная навигация"><a href="/catalog/">Каталог</a><a href="/#branding">Нанесение</a><a href="/#about">О нас</a><a href="/#contacts">Контакты</a><a href="/#favorites">Избранное</a></nav>
    </header>

    <main>
      <template v-if="section === 'home'">
        <section class="hero container">
          <div class="hero-copy"><div class="eyebrow"><span></span> КОРПОРАТИВНЫЕ ПОДАРКИ И МЕРЧ</div><h1>Не просто дарить.<br />Оставлять<br /><em>впечатление.</em></h1><p>Подарки с характером вашего бренда.<br />Для тех, кого вы цените.</p><a class="button button-lime" href="/catalog/">Найти свой мерч <ArrowUpRight :size="20" /></a><div class="hero-footnote"><span class="tiny-star">✳</span> Вещи, которыми хочется пользоваться</div></div>
          <div class="hero-art" aria-label="Идеи корпоративных подарков">
            <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><span class="art-caption">THOUGHTFUL GIFTS.<br />LASTING IMPRESSIONS.</span><div class="art-spark">✳</div>
            <div class="brand-paper"><span>made to<br /><b>be remembered.</b></span><span class="paper-logo">MEDIAPRO</span></div>
            <button v-for="(p, i) in heroProducts" :key="p.id" class="hero-product" :class="`hero-product-${i}`" @click="openProduct(p)" :aria-label="p.name"><img :src="p.images[0]" :alt="p.name" @error="fallbackImage" /><span>{{ i === 0 ? 'Ежедневные ритуалы' : i === 1 ? 'Всегда с собой' : 'Для больших идей' }} <ArrowUpRight :size="14" /></span></button>
            <div v-if="!heroProducts.length" class="hero-placeholder"><Gift :size="100" :stroke-width="0.7" /><span>Ваш бренд.<br />В каждой детали.</span></div>
            <div class="round-stamp">ВАШ БРЕНД<br /><Sparkles :size="25" /><span>ИХ ЛЮБИМАЯ ВЕЩЬ</span></div>
          </div>
        </section>
        <div class="container benefits-strip"><div><Palette :size="22" /><span>Нанесение вашего логотипа</span></div><div><Gift :size="22" /><span>От промоподарка до welcome pack</span></div><div><PackageCheck :size="22" /><span>Подбор под задачу и бюджет</span></div><div><Truck :size="22" /><span>Для бизнеса в Казахстане</span></div></div>

        <section class="container categories-section"><div class="section-heading"><div><span class="section-kicker">НАЙДИТЕ СВОЁ</span><h2>Хороший подарок начинается с идеи</h2></div><a class="text-link" href="/catalog/">Весь каталог <ArrowUpRight :size="18" /></a></div><div class="category-grid"><button v-for="c in categories" :key="c.slug" class="category-card" @click="goCatalog(c.slug)"><span class="category-icon"><component :is="icons[c.slug]" :size="31" :stroke-width="1.3" /></span><span>{{ c.name }}</span><small>{{ formatNumber(c.count) }} товаров</small><ArrowUpRight class="category-arrow" :size="16" /></button></div><div v-if="initError" class="error-box">{{ initError }} <button @click="initialize">Обновить каталог</button></div></section>
      </template>

      <section id="catalog" class="container catalog-section" :class="{ 'full-catalog': section !== 'home' }">
        <div v-if="section !== 'home'" class="breadcrumbs"><a href="/">Главная</a><ChevronRight :size="13" /><span>{{ section === 'favorites' ? 'Избранное' : 'Каталог' }}</span></div>
        <div class="section-heading catalog-heading"><div><span class="section-kicker">{{ section === 'favorites' ? 'ТО, ЧТО ВАМ ПОНРАВИЛОСЬ' : section === 'catalog' ? 'ПОДАРКИ, КОТОРЫЕ РАБОТАЮТ НА ВАШ БРЕНД' : 'ДЛЯ РАБОТЫ. ДЛЯ ЖИЗНИ. ДЛЯ ВАШЕГО БРЕНДА.' }}</span><component :is="section === 'home' ? 'h2' : 'h1'">{{ section === 'favorites' ? 'Ваше избранное' : section === 'catalog' ? 'Каталог корпоративных подарков и мерча' : 'Маленькие вещи. Большое впечатление.' }}<sup v-if="section === 'catalog'">{{ formatNumber(meta.total) }}</sup></component></div><a v-if="section === 'home'" href="/catalog/" class="text-link">Посмотреть всё <ArrowUpRight :size="18" /></a></div>
        <template v-if="section === 'catalog'">
          <div class="catalog-search"><Search :size="21" /><input v-model="searchInput" aria-label="Поиск по названию или артикулу" placeholder="Что подарим? Название, идея или артикул…" /><button v-if="query" class="icon-button" aria-label="Очистить поиск" @click="query = ''"><X :size="18" /></button><span class="search-hint">Найдём то самое</span></div>
          <div class="catalog-toolbar"><div class="category-tabs"><button :class="{ active: !category }" @click="category = ''">Все товары</button><button v-for="c in categories" :key="c.slug" :class="{ active: category === c.slug }" @click="selectCategory(c.slug)">{{ c.name }}</button></div><div class="catalog-controls"><button class="filter-toggle" :class="{ active: filterOpen }" @click="filterOpen = !filterOpen"><SlidersHorizontal :size="16" /> Фильтры <b v-if="filterCount">{{ filterCount }}</b></button><span class="results-count">{{ formatNumber(pagination.total) }} товаров</span><label class="sort-select"><span class="sr-only">Сортировка</span><select v-model="sort"><option value="recommended">Рекомендуем</option><option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option><option value="newest">Недавно добавлены</option></select><ChevronDown :size="15" /></label></div></div>
          <div v-if="filterOpen" class="filter-panel"><label>Коллекция<select v-model="provider"><option value="">Все коллекции</option><option value="oasis">Oasis</option><option value="arte">Arte Gifts</option></select></label><label>Цена до, ₸<input v-model="maxPrice" type="number" min="0" placeholder="Без ограничений" /></label><label class="checkbox-label"><input v-model="inStock" type="checkbox" /> Только в наличии</label><button class="text-link" @click="resetFilters">Сбросить фильтры <X :size="14" /></button></div>
        </template>
        <div v-if="loading" class="product-grid" aria-label="Загрузка товаров" aria-busy="true"><div v-for="i in 8" :key="i" class="skeleton-card"><div></div><span></span><span></span></div></div>
        <div v-else-if="catalogError && section === 'catalog'" class="empty-state"><PackageCheck :size="40" /><h3>Не удалось загрузить каталог</h3><p>{{ catalogError }}</p><button class="button button-dark" @click="loadCatalog()">Попробовать ещё раз</button></div>
        <div v-else-if="displayed.length" class="product-grid"><ProductCard v-for="p in displayed" :key="p.id" :product="p" :saved="isSaved(p)" :selected="isSelected(p)" @open="openProduct" @save="save" @add="add" /></div>
        <div v-else class="empty-state"><Heart v-if="section === 'favorites'" :size="40" /><Search v-else :size="40" /><h3>{{ section === 'favorites' ? 'Здесь будут ваши любимые идеи' : 'Пока ничего не нашли' }}</h3><p>{{ section === 'favorites' ? 'Нажмите на сердечко у товара, чтобы вернуться к нему позже.' : 'Попробуйте другое название или измените фильтры. Мы всегда можем помочь с подбором.' }}</p><button class="button button-dark" @click="section === 'favorites' ? goCatalog() : resetFilters()">{{ section === 'favorites' ? 'Посмотреть каталог' : 'Сбросить фильтры' }}</button></div>
        <div v-if="section === 'catalog' && !loading && pagination.last_page > 1" class="pagination"><button :disabled="pagination.current_page <= 1" aria-label="Предыдущая страница" @click="changePage(pagination.current_page - 1)"><ArrowLeft :size="18" /></button><span>{{ pagination.current_page }} <small>из {{ pagination.last_page }}</small></span><button :disabled="pagination.current_page >= pagination.last_page" aria-label="Следующая страница" @click="changePage(pagination.current_page + 1)"><ArrowRight :size="18" /></button></div>
        <div v-if="section === 'home' && featured.length" class="catalog-footer"><span>Это только начало вашей истории.</span><a class="button button-outline" href="/catalog/">Ещё больше идей <ArrowUpRight :size="18" /></a></div>
        <p v-if="displayed.length" class="price-note">Цены указаны за товар без нанесения. Итоговую стоимость, наличие и сроки подтвердим при расчёте заказа.</p>
      </section>

      <template v-if="section === 'home'">
        <section id="branding" class="container branding-section"><div class="branding-art"><div class="print-circle"></div><div class="brand-card card-back"><span>YOUR<br />BRAND<br />HERE.</span><Sparkles :size="32" /></div><div class="brand-card card-front"><span class="print-label">СОЗДАНО ДЛЯ ВАС</span><span class="print-logo">Ваш<br /><i>характер.</i></span><span>В каждой детали. <ArrowUpRight :size="23" /></span></div><span class="art-label">ИДЕЯ → ПРЕДМЕТ → ВПЕЧАТЛЕНИЕ</span></div><div class="branding-copy"><span class="section-kicker">БОЛЬШЕ, ЧЕМ ЛОГОТИП</span><h2>Обычная вещь.<br />Ваша история.</h2><p>Логотип, цвет, фактура, упаковка — каждая деталь может рассказать о вашем бренде. Поможем выбрать продукцию и подходящий способ нанесения.</p><div class="branding-tags"><span>Печать</span><span>Гравировка</span><span>Вышивка</span><span>Тиснение</span></div><button class="button button-dark" @click="openRequest('Хочу обсудить нанесение логотипа на продукцию.')">Обсудить вашу идею <ArrowUpRight :size="18" /></button></div></section>
        <section class="container occasions-section"><div class="section-heading"><div><span class="section-kicker">ПОВОД ЕСТЬ ВСЕГДА</span><h2>Для тех, кто важен</h2></div><p>Вы знаете своих людей.<br />Мы знаем, как их порадовать.</p></div><div class="occasion-grid"><button class="occasion-card occasion-team" @click="openRequest('Подберите welcome pack и мерч для сотрудников.')"><span class="occasion-number">01 / КОМАНДЕ</span><Shirt :size="66" :stroke-width="0.8" /><h3>Чувство<br />принадлежности</h3><p>Welcome pack и мерч,<br />который объединяет.</p><ArrowUpRight :size="26" /></button><button class="occasion-card occasion-clients" @click="openRequest('Подберите корпоративные подарки для клиентов.')"><span class="occasion-number">02 / КЛИЕНТАМ</span><Coffee :size="66" :stroke-width="0.8" /><h3>Внимание,<br />которое помнят</h3><p>Полезные подарки,<br />которые остаются рядом.</p><ArrowUpRight :size="26" /></button><button class="occasion-card occasion-partners" @click="openRequest('Подберите подарочные наборы для партнёров.')"><span class="occasion-number">03 / ПАРТНЁРАМ</span><Gift :size="66" :stroke-width="0.8" /><h3>Больше,<br />чем формальность</h3><p>Особенные вещи<br />для важных отношений.</p><ArrowUpRight :size="26" /></button></div></section>
        <section id="about" class="container about-section"><div><span class="section-kicker">ЗНАКОМИМСЯ. МЫ — MEDIAPRO</span><h2>Ваш бренд<br />должен <em>запоминаться.</em></h2></div><div><p class="about-lead">Люди забывают рекламу. Но помнят то, чем пользуются, что вызывает эмоции и что хочется оставить себе.</p><p>MEDIAPRO — корпоративные подарки, мерч и брендированная продукция, которые работают на ваш имидж. Мы помогаем находить решения, которые соответствуют вашему бренду, задачам и бюджету.</p><p>Для клиентов, которые ценят ваше внимание. Для сотрудников, которые разделяют ваши ценности. Для партнёров, с которыми вы строите будущее.</p></div></section>
      </template>

      <section id="contacts" class="contact-section"><div class="container contact-inner"><div><span class="section-kicker">ДАВАЙТЕ СОЗДАДИМ ЧТО-ТО ЗАПОМИНАЮЩЕЕСЯ</span><h2>Есть идея?<br />Давайте <em>подарим ей форму.</em></h2><p>Расскажите, для кого выбираете подарок.<br />Остальное придумаем вместе.</p><button class="button button-lime" @click="openRequest()">Обсудить проект <ArrowUpRight :size="19" /></button></div><div class="contact-details"><span>ПОЗВОНИТЕ НАМ</span><a href="tel:+77073544719">+7 (707) 354-47-19 <ArrowUpRight :size="25" /></a><a href="tel:+77018317825">+7 (701) 831-78-25 <ArrowUpRight :size="25" /></a><a class="whatsapp-link" href="https://wa.me/77073544719" target="_blank" rel="noopener noreferrer">Или напишите в WhatsApp <ArrowUpRight :size="16" /></a><div class="contact-star">✳</div></div></div></section>
    </main>
    <footer class="site-footer container"><div class="footer-top"><a class="logo" href="/">MEDIA<span>PRO</span><i>®</i></a><span>Не просто дарить. Оставлять впечатление.</span><a href="/catalog/">Каталог <ArrowUpRight :size="15" /></a></div><div class="footer-bottom"><span>© {{ new Date().getFullYear() }} MEDIAPRO. Казахстан.</span><button @click="privacyDialog.showModal()">Обработка персональных данных</button><span>Подарки с характером вашего бренда</span></div></footer>

    <dialog ref="productDialog" class="product-dialog" aria-labelledby="product-dialog-title" @click="backdrop($event, productDialog)"><div v-if="activeProduct" class="product-dialog-inner"><button class="dialog-close icon-button" aria-label="Закрыть товар" @click="productDialog.close()"><X /></button><div class="detail-gallery"><div class="detail-main-image"><img v-if="detailImage" :key="detailImage" :src="detailImage" :alt="activeProduct.name" @error="markDetailImageFailed(detailImage)" /><ImageIcon v-else :size="80" :stroke-width="1" /></div><div v-if="detailImages.length > 1" class="detail-thumbnails"><button v-for="(image, i) in detailImages" :key="image" :class="{ active: selectedImage === i }" :aria-label="`Фотография ${i + 1}`" @click="selectedImage = i"><img :src="image" alt="" loading="lazy" @error="markDetailImageFailed(image)" /></button></div></div><div class="detail-copy"><span class="section-kicker">{{ activeProduct.brand || 'МЕРЧ С ВАШИМ ЛОГОТИПОМ' }}</span><h2 id="product-dialog-title">{{ activeProduct.name }}</h2><span class="detail-article">Артикул {{ activeProduct.article }} · {{ activeProduct.provider === 'oasis' ? 'Oasis' : 'Arte Gifts' }}</span><div class="detail-price">{{ formatRetailPrice(activeProduct.price, activeProduct.provider) }}<span>за штуку, без нанесения</span></div><p class="detail-stock"><span :class="{ 'stock-dot': activeProduct.stock > 0 }"></span>{{ activeProduct.stock === null ? 'Наличие уточняйте' : activeProduct.stock > 0 ? `На складе поставщика: ${formatNumber(activeProduct.stock)} шт.` : 'Поставка под заказ — уточните сроки' }}</p><div class="detail-actions"><button class="button button-dark" @click="add(activeProduct)">{{ isSelected(activeProduct) ? 'Открыть подборку' : 'Добавить в подборку' }}<ShoppingBag :size="18" /></button><button class="icon-button detail-heart" :aria-label="isSaved(activeProduct) ? 'Убрать из избранного' : 'В избранное'" @click="save(activeProduct)"><Heart :size="22" :fill="isSaved(activeProduct) ? 'currentColor' : 'none'" /></button></div><p class="detail-description">{{ activeProduct.description }}</p><dl class="detail-attributes"><template v-for="(attr, i) in activeProduct.attributes" :key="i"><dt>{{ attr.name }}</dt><dd>{{ attr.value }}</dd></template></dl><p class="price-note">Итоговую стоимость с нанесением и сроки доставки рассчитаем индивидуально.</p></div></div></dialog>

    <dialog ref="cartDialog" class="cart-dialog" aria-labelledby="cart-title" @click="backdrop($event, cartDialog)"><div class="cart-dialog-inner"><div class="drawer-heading"><div><span class="section-kicker">ВАШ БУДУЩИЙ МЕРЧ</span><h2 id="cart-title">{{ success ? 'Начало положено!' : 'Ваша подборка' }}<sup v-if="!success">{{ cartCount }}</sup></h2></div><button class="icon-button" aria-label="Закрыть подборку" @click="cartDialog.close()"><X /></button></div><div v-if="success" class="success-state"><div><Check :size="38" /></div><h3>Спасибо за вашу идею</h3><p>Заявка сохранена. Свяжемся с вами, чтобы уточнить детали и подготовить расчёт.</p><small>Номер заявки: {{ success.slice(0, 8).toUpperCase() }}</small><button class="button button-dark" @click="cartDialog.close()">Продолжить знакомство <ArrowRight :size="18" /></button></div><template v-else><div v-if="cart.length" class="cart-items"><div v-for="p in cart" :key="p.id" class="cart-item"><img :src="p.images?.[0]" :alt="p.name" @error="fallbackImage" /><div class="cart-item-copy"><strong>{{ p.name }}</strong><small>арт. {{ p.article }}</small><div class="quantity-control"><button :disabled="p.quantity <= 1" aria-label="Уменьшить количество" @click="p.quantity--"><Minus :size="13" /></button><input v-model.number="p.quantity" type="number" min="1" max="100000" :aria-label="`Количество ${p.name}`" @change="p.quantity = Math.min(100000, Math.max(1, Math.floor(Number(p.quantity) || 1)))" /><button :disabled="p.quantity >= 100000" aria-label="Увеличить количество" @click="p.quantity++"><Plus :size="13" /></button></div></div><div class="cart-item-right"><button class="icon-button" aria-label="Удалить товар" @click="cart = cart.filter(x => x.id !== p.id)"><Trash2 :size="16" /></button><strong>{{ p.price === null ? 'По запросу' : formatMoney(retailPriceInTiyn(p.price, p.provider) * p.quantity) }}</strong></div></div><div class="cart-summary"><span>{{ hasUnknownPrice ? 'Известная часть стоимости' : 'Предварительная стоимость' }}</span><strong>{{ formatMoney(cartTotal) }}</strong></div><p class="price-note">Без нанесения и доставки. Подтвердим цену, наличие и минимальный тираж при расчёте.</p></div><p v-else class="request-intro">Можете добавить товары из каталога или просто рассказать о задаче — поможем подобрать подходящие подарки.</p><form class="inquiry-form" @submit.prevent="submitInquiry"><h3>Обсудим детали?</h3><p>Оставьте контакты, и мы подготовим предложение.</p><label>Как к вам обращаться *<input v-model="form.name" autocomplete="name" required minlength="2" maxlength="120" placeholder="Ваше имя" /></label><div class="form-row"><label>Телефон *<input v-model="form.phone" autocomplete="tel" type="tel" required pattern="\+?[0-9\s\(\)\-]{10,25}" maxlength="25" placeholder="+7 (___) ___-__-__" /></label><label>Email<input v-model="form.email" type="email" autocomplete="email" placeholder="you@company.kz" maxlength="254" /></label></div><label>Компания<input v-model="form.company" autocomplete="organization" placeholder="Название компании" maxlength="200" /></label><label>Пара слов о задаче<textarea v-model="form.message" rows="3" maxlength="5000" placeholder="Для кого подарок, какой тираж, бюджет и сроки?" /></label><label class="honeypot" aria-hidden="true">Сайт<input v-model="form.website" tabindex="-1" autocomplete="off" /></label><label class="consent-label"><input v-model="form.consent" type="checkbox" required /><span>Согласен на <button type="button" @click="privacyDialog.showModal()">обработку персональных данных</button> для ответа на заявку.</span></label><p v-if="submitError" class="form-error" role="alert">{{ submitError }}</p><button class="button button-dark submit-button" :disabled="submitting"><LoaderCircle v-if="submitting" class="spin" :size="18" />{{ submitting ? 'Сохраняем заявку…' : 'Получить предложение' }}<ArrowUpRight v-if="!submitting" :size="18" /></button></form></template></div></dialog>

    <dialog ref="privacyDialog" class="privacy-dialog" aria-labelledby="privacy-title" @click="backdrop($event, privacyDialog)"><div><button class="dialog-close icon-button" aria-label="Закрыть" @click="privacyDialog.close()"><X /></button><span class="section-kicker">MEDIAPRO</span><h2 id="privacy-title">Обработка данных заявки</h2><p>Отправляя заявку, вы разрешаете MEDIAPRO использовать указанные вами имя, телефон, email, название компании и сведения о заказе, чтобы связаться с вами и подготовить предложение.</p><p>Заявка сохраняется на сервере MEDIAPRO. Она не отправляется поставщикам каталогов автоматически. Избранное и подборка хранятся в вашем браузере.</p><p>Чтобы уточнить, изменить или удалить сведения из заявки, свяжитесь с нами по телефону <a href="tel:+77073544719">+7 (707) 354-47-19</a> и сообщите номер заявки.</p><button class="button button-dark" @click="privacyDialog.close()">Понятно <Check :size="17" /></button></div></dialog>
    <Transition name="toast"><div v-if="toast" class="toast-message" role="status"><Check :size="18" />{{ toast }}</div></Transition>
  </div>
</template>
