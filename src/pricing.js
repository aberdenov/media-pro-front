const markupNumerator = 13
const markupDenominator = 10
const formatter = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 2 })

export function retailPriceInTiyn(dealerPrice, provider) {
  const dealerPriceInTiyn = Math.round(Number(dealerPrice) * 100)
  return provider === 'oasis'
    ? Math.round(dealerPriceInTiyn * markupNumerator / markupDenominator)
    : dealerPriceInTiyn
}

export function formatMoney(priceInTiyn) {
  return `${formatter.format(priceInTiyn / 100)} ₸`
}

export function formatRetailPrice(dealerPrice, provider) {
  return dealerPrice === null ? 'Цена по запросу' : formatMoney(retailPriceInTiyn(dealerPrice, provider))
}
