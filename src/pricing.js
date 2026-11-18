const markupNumerator = 13
const markupDenominator = 10
const formatter = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 2 })

export function retailPriceInTiyn(dealerPrice) {
  const dealerPriceInTiyn = Math.round(Number(dealerPrice) * 100)
  return Math.round(dealerPriceInTiyn * markupNumerator / markupDenominator)
}

export function formatMoney(priceInTiyn) {
  return `${formatter.format(priceInTiyn / 100)} ₸`
}

export function formatRetailPrice(dealerPrice) {
  return dealerPrice === null ? 'Цена по запросу' : formatMoney(retailPriceInTiyn(dealerPrice))
}

export function dealerPriceLimit(retailLimit) {
  const limitInTiyn = Math.floor(Number(retailLimit) * 100 + 1e-8)
  // Include prices that round down to the displayed limit.
  const roundingAllowance = markupDenominator / 2 - 1
  return Math.floor((limitInTiyn * markupDenominator + roundingAllowance) / markupNumerator) / 100
}
